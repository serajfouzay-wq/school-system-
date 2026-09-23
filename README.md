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

A build made for a particular school uses `school-system-<id>` instead, so two
of them on one computer keep separate databases. See **One app, many schools**.

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
shared/palette.mjs         One colour -> eleven shades, in OKLCH

shared/modules.mjs         Which optional parts exist, and what each one owns
shared/license.mjs         The licence format and computer codes, for both sides

brands/                    One file per school: name, colour, details
clients/                   Their spreadsheets, kept out of version control
scripts/
  brand.mjs                Writes the generated palette and defaults
  make-icon.mjs            Draws the icon (Electron, so no image library)
  icon-fallback.mjs        Draws one without a screen, via png.mjs
  csv.mjs                  Reads the office's spreadsheets, forgivingly
  make-data.mjs            Turns those into the database the build ships
  build-school.mjs         The whole thing: `npm run school`
  builder/                 The page behind `npm run builder`
  license-keys.mjs         The workshop's signing key; makes licences
keys/                      That key. Never committed, never shipped: back it up
electron/license.ts        Checks the licence before anything else is allowed
electron/seed-cli.ts       Builds a school's database headlessly, at build time

src/                       Renderer — React, no filesystem or database access
  i18n/                    en.json / ar.json (733 keys, kept in lockstep)
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

## One app, many schools

Nothing in `src/` or `electron/` is edited to set up a new school. Everything
that differs lives in one file under `brands/`:

```jsonc
{
  "id": "alnoor",                       // folder and package name; keep it short
  "appName": "Al Noor School System",   // window title, installer, shortcut
  "appNameAr": "نظام مدرسة النور",
  "color": "#0f766e",                   // the only colour you have to choose
  "logo": "brands/alnoor-logo.png",     // optional; omit and a mark is drawn

  "school": {                           // all optional — pre-fills the wizard
    "name": "Al Noor International School",
    "name_ar": "مدرسة النور الدولية",
    "address": "Tripoli, Libya",
    "phone": "+218 91 234 5678",
    "currency": "LYD",
    "country_code": "218",
    "language": "ar"
  },

  // Optional. Shown at the top of the Help screen, above the general articles.
  "notes": "If the program will not start, call Seraj on +218 91 000 0000."
}
```

Then one command:

```bash
npm run school -- brands/alnoor.json --win     # Windows package
npm run school -- brands/alnoor.json --linux
npm run school -- brands/alnoor.json           # bundle only, no installer
```

A brand file can be as short as a name and a colour. `brands/example.json` is
there to copy; `brands/default.json` is the plain unbranded build.

### Or without touching a file at all

```bash
npm run builder
```

opens a page in the browser: name, colour, logo, which parts the school gets,
and their spreadsheets. Press **Create** and it writes the brand file, runs the
whole build, and shows the output as it happens. It can also load a school you
made before, to change something and build again.

Everything below is what that page is driving, and what to edit by hand if you
would rather.

### What the school gets

Each optional part can be left out of a build:

```jsonc
"modules": {
  "transport": false,     // this school has no buses
  "library": false
}
```

The choices are `grades`, `exams`, `fees`, `timetable`, `library`, `transport`,
`announcements`, `reports` and `whatsapp`. Anything not mentioned is included.
Students, staff, attendance, classes, settings, the recycle bin and help are
the system itself and are always present.

A module that is off is **not merely hidden**. Its screens leave the menu, and
the main process refuses every action behind it — a build without Transport
answers `transport.*` with "This part of the system is not included", so
nothing can reach data the school did not buy. Dependencies are applied for
you: exams write their marks into Grades, so asking for exams without grades
turns exams off rather than shipping a screen with nowhere to put a result.

### Their data, in before you send it

A build can carry the school's own records, so the client installs the program
and their school is simply there — no wizard, no import, nobody retyping.

```jsonc
"data": {
  "classes":  "clients/alnoor/classes.csv",
  "subjects": "clients/alnoor/subjects.csv",
  "students": "clients/alnoor/students.csv",
  "staff":    "clients/alnoor/staff.csv",
  "terms":    [{ "name": "First Term", "name_ar": "الفصل الأول" }],
  "owner":    { "name": "Mr Seraj", "username": "owner", "pin": "4321" }
}
```

The CSV files are whatever the office already has. Column names are matched
loosely and in either language — `Full Name`, `student_name`, `الاسم` all land
in the same place — and quoted commas, embedded newlines, semicolon separators,
a byte-order mark and Windows line endings are all handled. A class a student
mentions that the classes file never listed is created rather than leaving that
student unplaced.

`scripts/make-data.mjs` reads those files and hands a plan to a headless copy
of the app itself (`electron/seed-cli.ts`), so student codes, PIN hashing and
every other rule hold exactly as if a person had typed it all in. The result is
a `school_data.db` that ships inside the package and is moved into place the
first time the program runs — and only then: an installation that already has
data is never overwritten, however many times it is reinstalled.

Leave the `data` block out and the client gets the setup wizard instead.

**These files are real people.** `clients/` and `brands/` are in `.gitignore`
apart from the examples, so a school's names and phone numbers stay on the
machine that made the build.

### What the colour actually does

You give one colour. The rest of the palette — eleven shades for buttons,
hovers, tints, charts and printed documents — is derived from it in OKLCH, so
the ramp is evenly spaced to the eye whatever hue you start from. HSL is not
used, because the same numbers that suit a blue make a yellow look washed out.

**The colour is adjusted if it would be unreadable.** White text on a mid-tone
button is the assumption throughout the interface, and for a pale green or an
amber that assumption fails. The main shade is therefore darkened until white
text on it clears WCAG AA (4.5:1), with the pale and dark ends held in place and
the rest re-spaced between them. `#f59e0b` becomes `#a56800` on the buttons; the
tints stay amber. The generator refuses to finish if it cannot reach the target.

### What gets generated

`npm run school` writes these, and they are committed so a plain `npm run build`
still works:

| File | What it carries |
|---|---|
| `src/brand.generated.css` | The eleven shades as CSS variables |
| `src/brand.generated.ts` | Palette, app name, school defaults, for the interface |
| `electron/brand.generated.json` | The same, for the main process |
| `build/icon.png` | The logo, or a mark drawn from the school's initials |
| `preseed/school_data.db` | The school's own data, when the brand file supplies any |

Tailwind's `brand-*` classes read the CSS variables rather than baked-in hex, so
one build can wear any colour. Charts and printed documents — which cannot see
the stylesheet — are handed the palette directly.

### Keeping a copy on the school's computers

Every client build is **locked**: it opens only on computers it holds a licence
for. Copying it to another computer — the installer, the installed program, or
the data folder — does not give anyone a working system to resell.

**How it works.** The first client build makes a signing key in `keys/` on the
workshop machine. Each build carries the public half; the private half never
leaves `keys/`. On start the program works out a code for the computer it is on
(from the identity Windows gives an installation, hashed) and looks for a
licence, signed with that key, naming both this school's build and this code.
Without one it shows its code and an activation screen, and the main process
refuses every other action — the school's data stays closed, not merely hidden.
A licence cannot be edited to add a computer (the signature breaks), moved to
another school's build (it names the build), or made without `keys/`.

**Activating a computer.**

1. Install as usual. The first screen shows the computer's code, e.g.
   `K7QF-3M9D-XW2P-A4TE`, and your note (put your phone number in it).
2. On the workshop page, **Activate a computer**: pick the school, type the
   code, **Make activation key**.
3. Give the key back: **Save as a file** onto the USB stick and press **Open
   the licence file** on their screen, or **Copy** it into WhatsApp and they
   paste it. Words around it in the message do not matter.

If you already know a computer's code when you build, put it in **Their
computer codes** and that computer opens the program straight away with no
activation step. Every licence you make is also saved under
`clients/<school>/licences/`, as a record of which computers each school has.

A licence is kept beside the school's data, so reinstalling or updating the
program keeps it. Reinstalling Windows or replacing the computer gives a new
code; activate it the same way.

**Back up `keys/`.** Lose it and schools you have already set up keep working,
but you cannot activate a new or replaced computer for them without building
and installing their copy again. Whoever has `license-private.pem` can
activate copies of your system, so keep it to yourself.

A demo to show a prospective school can be built unlocked: untick **Lock this
copy** on the page, or put `"license": false` in the brand file. The plain
default build is never locked.

**The executable is hardened too.** Packaging switches off Electron's ways
around the check: running the program as plain Node, attaching a debugger,
`NODE_OPTIONS`, and loading the app from anywhere but its own archive. On
Windows the archive is also checked against a fingerprint stamped into the
`.exe`, so editing the check out of `app.asar` stops the program starting.

**What this does not do.** No desktop program is uncrackable. This stops the
realistic threat — someone copying a school's installation, or your installer,
to sell on — and anyone short of a skilled reverse engineer willing to patch the
executable. The school's database itself is an ordinary SQLite file: it belongs
to the school, and locking the program does not encrypt it.

### Two schools on one computer

Each branded build keeps its own database folder (`school-system-<id>`), so
installing two of them side by side does not have one writing over the other.
The unbranded build keeps the original folder name, so existing installations
find the data they already have.

### Changing a colour without rebuilding

Settings → School information has a colour picker that repaints the interface as
you choose. It is stored against the school, so it survives restarts and needs
no new installer — the brand file only decides what the app looks like out of
the box. A colour typed by hand that makes no sense is ignored rather than
breaking the screen.

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

- **`build/icon.png` is a placeholder** for the unbranded build. A school build
  gets its own: point `logo` in the brand file at a PNG, or leave it out and a
  mark is drawn from the school's initials on their colour.
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
