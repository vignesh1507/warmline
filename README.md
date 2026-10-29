# Warmline

A companion for friendships, not a calendar. It remembers what you told it about the
people you care about, helps you prepare for what's coming, and asks how it went
afterwards — so the next suggestion knows something the last one didn't.

Gemma does the reading and the suggesting. Everything it proposes is editable before it
is saved, and every idea either cites the notes it came from or admits it is a guess.

```
Home        what's coming up, who's cooling off, add something by typing it
Event       prep ideas, an echo from your notes, a rehearsal, reminders, edit/delete
People      everyone you've added, coldest first, with what you know about them
Inbox       things noticed in WhatsApp, waiting for you to accept or reject
Settings    reminder timing, chat consent, what gets sent to Gemma, export, delete
```

## What makes it more than a reminder app

- **A warmth meter.** Every person has a rhythm you chose — monthly, fortnightly,
  twice a year. Warmth decays with a half-life equal to that rhythm, so "three weeks"
  is warm for one friendship and cold for another. It's plain arithmetic
  (`100 · 2^(−days/cadence)`), never a model's opinion.
- **Open loops.** The promises that fall through the cracks — "I'll send you that
  recipe", "you still have my drill" — tracked in both directions, with a nudge when
  one goes stale.
- **Echoes.** When something's coming up, Warmline resurfaces a real note from months
  ago, shown with its date and original wording. It picks which note; it never writes
  the memory.
- **Rehearsal.** For the conversations that are hard to start — an apology, a
  condolence, asking a favour — two openers, what they might be feeling, one thing not
  to say. Hedged, and clearly marked as guesses.

## Running it

You need Node 20+, pnpm, and a Postgres you can write to.

```bash
pnpm install
cp .env.example .env     # then fill in DATABASE_URL, APP_PASSCODE and AI_API_KEY
pnpm db:migrate
pnpm db:seed             # optional: a few people and events to look at
pnpm dev                 # http://localhost:3100
```

No Postgres handy? `docker compose up -d db` starts one on port 5433 — switch
`DATABASE_URL` to the commented line in `.env`.

### Gemma

`AI_PROVIDER` picks where Gemma runs:

| value | what it means |
|---|---|
| `aistudio` (default) | Google AI Studio. Free tier content may be used to improve Google's products — fine for demo data, think twice for real notes about real people. |
| `ollama` | Fully local. `ollama pull gemma3`, set `AI_PROVIDER=ollama`, and nothing leaves your machine. |
| `openrouter` | Any Gemma on OpenRouter. |

Settings shows exactly what is sent, and context is trimmed and stripped of emails,
links and long numbers first.

### The WhatsApp bridge

```bash
pnpm bridge                  # WA_FAKE=1 in .env replays a scripted conversation
```

Fixture mode is the place to start: it offers three chats, and ticking one in Settings
replays its messages so you can watch the whole path — proposal, inbox, accept — without
linking an account.

For the real thing, set `WA_FAKE=0` and run it again. A QR appears in the terminal *and*
on the Settings screen; scan it with WhatsApp → Settings → Linked devices. It runs on
macOS, Windows, Linux and Docker, and finds whichever Chrome you already have (or set
`PUPPETEER_EXECUTABLE_PATH`, or run `pnpm chrome:install`).

**Worth knowing before you link an account.** WhatsApp publishes no API for personal
accounts, so this drives a real WhatsApp Web session through
[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). It is unofficial,
against WhatsApp's terms, can break whenever they change their web client, and carries
some risk to the number. It is built to read and nothing else:

- no chat is touched until you tick it in Settings, checked again server-side;
- messages are read, turned into proposals, and dropped — never stored, unless you turn
  on short quotes;
- nothing reaches your real data without you accepting it in the Inbox;
- it cannot send, reply or react. `apps/bridge/test/receive-only.test.ts` fails the build
  if anyone adds a call that could.

## Layout

```
apps/web         Next.js 16 app — screens, server actions, bridge API
apps/bridge      the WhatsApp worker; runs anywhere Node does
packages/db      Prisma schema, migrations, seed
packages/ai      Gemma adapters, prompts, typed contracts, grounding validator
packages/shared  warmth maths and date logic, shared by web and bridge
```

Two pieces are worth reading first: `packages/shared/src/warmth.ts` (the meter) and
`packages/ai/src/grounding.ts` (why a suggestion can't invent a memory).

## Scripts

```bash
pnpm dev            # web app on :3100
pnpm bridge         # WhatsApp bridge
pnpm test           # 46 unit tests: warmth, dates, grounding, extraction, the no-send guard
pnpm build          # production build
pnpm db:migrate     # apply migrations
pnpm db:studio      # browse the database
pnpm chrome:install # only if the bridge can't find a browser
```

## Deploying

Postgres on DigitalOcean, both services on Render — see [DEPLOY.md](DEPLOY.md).
