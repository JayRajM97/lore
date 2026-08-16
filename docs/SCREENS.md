# Lore — Screen Reference

Every screen in the app, one line each, with reference screenshots in
[`docs/screens/`](screens/). Captured from the production web build with a
seeded demo session (fake episodes, no real Gmail data).

## Entry & onboarding flow

| # | Screen | Route | What it is |
|---|--------|-------|------------|
| — | Splash | `/` | Brief logo splash, then routes everyone to Home (catalog-first). |
| 01 | [Home — browse (signed out)](screens/01-home-browse.png) | `/home` | Landing for visitors: the global feed of already-converted newsletters, playable with zero signup; "Connect Gmail" pill in the header. |
| 02 | [Onboarding](screens/02-onboarding.png) | `/onboarding` | The pitch screen (Connect Gmail / Discover cards); only seen via explicit navigation now that Home is the landing page. |
| 03 | [Gmail connect](screens/03-gmail-connect.png) | `/gmail` | One-time Google OAuth: connect once, refresh tokens make every later sync silent. |
| 09 | [Inbox scan](screens/09-scan-explore.png) | `/scan` | Scans Gmail for newsletters; below the status, "Listen while you wait" plays catalog episodes inline via MiniPlayer. Completion becomes a button (never yanks you mid-listen). |
| 10 | [Select newsletters](screens/10-select-newsletters.png) | `(auth)/discover` | Scan results: check the newsletters you want; "View" opens a sheet with recent issues + the rich reader (Reader/Original toggle). |
| — | Generating | `(auth)/generating` | Post-selection queue: fetches recent issues and creates episode placeholders (no TTS — audio synthesizes on first play). |

## Main tabs

| # | Screen | Route | What it is |
|---|--------|-------|------------|
| 05 | [Home — feed (signed in)](screens/05-home-feed.png) | `/home` | Featured episode card, Up Next (cards/list toggle), Latest Converted grid, Listen Again, My Newsletters shelf. |
| 04 | [Discover tab](screens/04-discover-tab.png) | `/discover` | Public catalog: popular / trending / new newsletters anyone can follow. |
| 06 | [Library — episodes](screens/06-library-cards.png) | `/library` | All your episodes; cards/list toggle (cards default). |
| 07 | [Library — listened](screens/07-library-listened.png) | `/library` | Tab of everything you've played (tracked locally), for picking up where you left off. |
| 08 | [Profile](screens/08-profile.png) | `/profile` | Identity, followed newsletters (with remove), rescan, sign out. |
| — | Newsletter detail | `/newsletter/[id]` | One newsletter's page: follow/unfollow + all its episodes. |

## Player

| # | Screen | Route | What it is |
|---|--------|-------|------------|
| 11 | [Player — light (default)](screens/11-player-light.png) | `/player` | Light-first now-playing: stacked-card artwork, serif title, smooth scrubber, Player/Read/Original segments, dark-mode toggle top-right. |
| 12 | [Player — Read Along](screens/12-player-readalong.png) | `/player` | The newsletter as a clean article (serif headings, inline images) with the currently-spoken line highlighted, auto-scroll, tap-to-seek. |
| 13 | [Player — dark](screens/13-player-dark.png) | `/player` | Same player in dark mode (toggle persists). |
| — | Original mode | `/player` | Third segment: the raw email exactly as sent (sandboxed frame, web only), re-fetched by Gmail message id. |

## Dev / legacy (not in normal navigation)

- `playground` — the original TTS playground (paste text → audio); kept for debugging.
- `(tabs)/search` — search screen, registered but not in the tab bar.
- `(tabs)/home2` — dead earlier home design; candidate for deletion.
- `components/LyricsView` — the old dark karaoke view; superseded by Read Along, kept in the tree.

## Regenerating these screenshots

The capture script (Playwright, seeds a demo session via `localStorage` +
`globalThis.__lore_episodes`) lives in session scratch — ask Claude to re-run
"the screen capture script" after UI changes, or screenshot manually at 430px
width against `npx expo export --platform web` + any static server.
