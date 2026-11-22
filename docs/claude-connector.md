# Connect BOVI to Claude

Ask Claude things like *"can I skip Friday's DSA class?"*, *"what's due this week?"* or *"how ready am I for IA2?"*, and let it add tasks, assignments, exams and ideas to BOVI.

BOVI has no servers of its own, so this works through **your own small server**. It's free, takes about five minutes to set up once, and only you have the key.

```
BOVI on your phone ──sync──▶ your server (Cloudflare, free) ◀──connector── Claude
```

## What Claude can do

| Read | Add |
|---|---|
| Today at a glance | Tasks (with a time, they show on the dial) |
| Timetable, including one-off changes | Assignments |
| Attendance per subject, and how many classes you can still miss | Exams |
| Exams with syllabus, topics left and readiness | Ideas |
| Assignments, tasks and today's habits | |
| Projects, milestones, ideas | |

Claude **can't edit or delete** anything in BOVI. Items it adds wait on your server and appear in BOVI the next time the app syncs.

BOVI syncs when you open it, when you leave it, and about 15 seconds after you change something. Each answer from Claude says how fresh the data is.

## Set it up

You need a computer with [Node.js](https://nodejs.org) 20 or newer, and a free [Cloudflare](https://dash.cloudflare.com/sign-up) account.

1. **Get the code.** Download this repository (Code → Download ZIP) and unzip it, or `git clone` it.
2. **Deploy your server.** In a terminal:
   ```sh
   cd server
   npm install
   npm run setup
   ```
   **On Windows PowerShell**, type `npm.cmd` instead of `npm` (PowerShell blocks `npm` by default): `npm.cmd install`, then `npm.cmd run setup`.

   A browser opens: sign in to Cloudflare and allow access. If Cloudflare asks to **register a workers.dev subdomain**, answer yes and pick any name; it becomes part of your address. The script then deploys your server, creates a random key and prints something like:
   ```
   In the BOVI app → Settings → Claude connector:
      Server   https://bovi-connector.your-name.workers.dev
      Key      9fJ3…
   In Claude (Settings → Connectors → Add custom connector):
      Name     BOVI
      URL      https://bovi-connector.your-name.workers.dev/mcp/9fJ3…
   ```
3. **Connect BOVI.** In the app, open Settings → **Claude connector**, paste the server address and the key, then tap **Connect**. You should see *Connected · Last synced just now*.
4. **Add it to Claude.** In Claude (web, desktop or phone), open Settings → **Connectors** → **Add custom connector**. Name it *BOVI*, paste the connector URL, and save. The BOVI screen in the app also shows this address, with a share button.
5. **Try it.** Ask Claude *"What's on today in BOVI?"*

## Privacy and security

- Your data goes only to your own Cloudflare account. The BOVI developer never sees it.
- The key works like a password: anyone with it, or with the connector URL, can read your BOVI data. Don't share either of them.
- To change the key, delete `server/.bovi-secret`, run `npm run setup` again, then update both BOVI and Claude.
- To stop completely, tap **Disconnect** in BOVI and delete the `bovi-connector` Worker in the Cloudflare dashboard.
- The key is never included in BOVI backups.

## Troubleshooting

| You see | Do this |
|---|---|
| *The server rejected the key* | Copy the key again from the setup output, or from `server/.bovi-secret`. |
| *That address isn't a BOVI connector* | Use the `…workers.dev` address only, without `/mcp/…`. |
| *The server isn't finished setting up* | Run `npm run setup` again. |
| *You need to register a workers.dev subdomain* | Open dash.cloudflare.com → Workers & Pages, choose a subdomain, then run `npm run setup` again. |
| PowerShell: *running scripts is disabled* | Use `npm.cmd` instead of `npm`. |
| `cd server` fails | Your copy of BOVI is older than the connector: `git pull`, or download the ZIP again. |
| Claude says the data may be out of date | Open BOVI so it syncs. |
| Claude can't find a subject | It uses BOVI's subject names; ask it to check `bovi_overview`. |

## For developers

The server is a single Cloudflare Worker with one Durable Object (`server/src`):

- `POST /sync`: the app sends its snapshot (`Authorization: Bearer <key>`) and gets back the items Claude added. It acknowledges them on the next sync.
- `POST /mcp/<key>`: an MCP server (Streamable HTTP, stateless JSON responses) with 12 tools: `bovi_overview`, `bovi_timetable`, `bovi_attendance`, `bovi_exams`, `bovi_tasks`, `bovi_projects`, `bovi_snapshot`, `bovi_pending`, `bovi_add_task`, `bovi_add_assignment`, `bovi_add_exam` and `bovi_add_idea`.

Run the tests with `npm test`, and run locally with `npm run dev` (put `BOVI_SECRET=...` in `server/.dev.vars`). The app builds the snapshot in `src/lib/agentSync.ts`, so the server needs none of BOVI's logic.
