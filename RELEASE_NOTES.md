## BOVI — Build · Organize · Visualize · Improve

A planner for college students and their own projects, built around a clock-style calendar. Android only. No account, no ads, no servers: everything stays on your phone.

### New in 1.7
- **Courses.** Follow self-paced courses (Udemy, YouTube, books) like a college subject, from the Projects tab. Paste the curriculum to get sections and lessons, tick them off, and set weekly study times: they show on the calendar dial, where one tap marks the session done. A finish date tells you how many lessons a week you need and when you'll actually finish at your current pace.

### New in 1.6
- **Phone use on the dial, explained.** A card under the calendar shows phone use for the hours you're looking at: the total, today against your limit, minutes per hour, the busiest hour and which apps took it (tap an hour for its top apps). The dial's outer ring now uses the same colours: grey under 15 min, amber 15–30 min, red 30+ min.

### New in 1.5
- **Semesters.** Give your semester a name and dates, and classes only show between them. When it ends, start a new one: the old semester is saved with its subjects, timetable, attendance, exams and marks, and you can keep the same subjects and timetable if they don't change. Switch back to any saved semester any time (Classes → Semester).
- Claude connector: Claude now knows which semester and week you're in. The setup also works when your Cloudflare account has no workers.dev subdomain yet.

### New in 1.4
- **Attendance, day by day.** A month calendar showing which days you were present, absent or missed some classes. Tap a day to see each class and mark it. Also new: your attendance streak, this month's %, the weekday you miss most, perfect days, an 8-week trend, and each subject's last 12 classes.
- **Connect BOVI to Claude (optional).** Ask Claude *"can I skip Friday's class?"* or *"what's due this week?"*, and let it add tasks, assignments, exams and ideas. It runs on your own free server, set up with one command. Guide: [docs/claude-connector.md](https://github.com/krishkumarravidas/BOVI-Build-Organize-Visualize-Improve/blob/main/docs/claude-connector.md)

### New in 1.3
- **The keyboard no longer covers what you're typing.** Every screen scrolls the field you tap into view above the keyboard.
- **Clock and calendar pickers.** Times and dates (classes, exams, tasks, habits, deadlines…) open Android's clock and calendar dialogs instead of asking you to type `08:30` or `2026-11-23`. They follow BOVI's black-and-white look and your light/dark setting.

### New in 1.2
- **Black and white.** A new 3D abstract logo and a monochrome look across the app, widgets and splash screen. Only red (problems), green (done) and amber (warnings) keep a colour, plus your subject colours on the calendar. A purple subject turns charcoal automatically.

### New in 1.1
- **A new look.** A calmer "ink & iris" palette, tonal buttons and chips, a flat bottom bar and a refreshed calendar dial, all checked for readable contrast in light and dark mode. Existing subjects move to the new colours automatically.
- Website: https://krishkumarravidas.github.io/BOVI-Build-Organize-Visualize-Improve/

### Install
1. Download **BOVI.apk** below (on your phone).
2. Open it. If Android asks, allow *Install unknown apps* for your browser or Files app.
3. Open BOVI. A short setup asks for your college, subjects and what to call your second tab (Projects, Game dev, Work…). Every step can be skipped.

Works on Android 7.0+ (64-bit and 32-bit ARM phones).

### What's inside
- **Universal calendar:** a rotating clock dial with your classes, exams, events, habits and tasks. Spin it through the day and past midnight into the next.
- **College:** timetable with one-off changes, exams with countdowns and readiness scores, attendance (import from your college portal with an AI-made file), assignments, marks, a study timer, flashcards and a revision planner.
- **Your second tab:** projects, milestones, a focus timer with session notes, devlog, ideas, weekly planning, streaks and a heatmap. Optional extras: bugs, playtests, builds, assets, reference board, Steam launch checklist, game jams.
- **Tasks and habits** with reminders, a morning briefing, weekly review and monthly report.
- **10 home-screen widgets**, **Share to BOVI** from any app, app-icon shortcuts, auto-backup to a folder you choose, and an app lock.

### Import your attendance
Attendance → *Update from portal* explains it step by step: screenshot your portal, send the built-in prompt to ChatGPT / Claude / Gemini with the screenshots, then paste or open the JSON it gives you.

### Notes
- This APK is signed with a development key (fine for installing yourself; Play Store builds would use a private key).
- Your data never leaves your phone unless you export a backup.
