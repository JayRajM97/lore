import WidgetKit
import SwiftUI

// ── Shared state written by the app (lib/widget.ts via App Group) ───────────

struct WidgetEpisode: Codable, Identifiable {
  let id: String
  let title: String
  let sender: String
}

struct WidgetState: Codable {
  let episodes: [WidgetEpisode]
  let updatedAt: Double
}

func readState() -> WidgetState {
  let empty = WidgetState(episodes: [], updatedAt: 0)
  guard
    let defaults = UserDefaults(suiteName: "group.com.jayraj.lore"),
    let raw = defaults.string(forKey: "lore_widget_state"),
    let data = raw.data(using: .utf8),
    let state = try? JSONDecoder().decode(WidgetState.self, from: data)
  else { return empty }
  return state
}

// ── Timeline ────────────────────────────────────────────────────────────────

struct LoreEntry: TimelineEntry {
  let date: Date
  let state: WidgetState
}

struct LoreProvider: TimelineProvider {
  func placeholder(in context: Context) -> LoreEntry {
    LoreEntry(date: Date(), state: WidgetState(
      episodes: [WidgetEpisode(id: "p", title: "A Japanese Ritual to Improve Your Habits", sender: "Sahil Bloom")],
      updatedAt: 0
    ))
  }
  func getSnapshot(in context: Context, completion: @escaping (LoreEntry) -> Void) {
    completion(LoreEntry(date: Date(), state: readState()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<LoreEntry>) -> Void) {
    let entry = LoreEntry(date: Date(), state: readState())
    // App reloads timelines on every play; hourly refresh is just a fallback.
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
  }
}

// ── Palette (Lore brand) ────────────────────────────────────────────────────

let lorePaper = Color(red: 0.98, green: 0.98, blue: 0.973)
let loreInk = Color(red: 0.173, green: 0.173, blue: 0.165)
let loreTeal = Color(red: 0.059, green: 0.431, blue: 0.337)
let loreMuted = Color(red: 0.373, green: 0.369, blue: 0.353)

// ── Views ───────────────────────────────────────────────────────────────────

struct EpisodeRow: View {
  let ep: WidgetEpisode
  var body: some View {
    HStack(spacing: 8) {
      // squircle monogram in place of remote artwork (widgets avoid network)
      ZStack {
        RoundedRectangle(cornerRadius: 7, style: .continuous).fill(loreTeal)
        Text(String(ep.sender.prefix(1))).font(.system(size: 12, weight: .heavy)).foregroundColor(.white)
      }
      .frame(width: 26, height: 26)
      VStack(alignment: .leading, spacing: 1) {
        Text(ep.title).font(.system(size: 11.5, weight: .semibold)).foregroundColor(loreInk).lineLimit(1)
        Text(ep.sender).font(.system(size: 9.5)).foregroundColor(loreMuted).lineLimit(1)
      }
      Spacer(minLength: 0)
      Image(systemName: "play.circle.fill").font(.system(size: 16)).foregroundColor(loreTeal)
    }
  }
}

struct LoreWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: LoreEntry

  var body: some View {
    let eps = entry.state.episodes

    Group {
      if eps.isEmpty {
        VStack(spacing: 5) {
          Text("Lore").font(.system(size: 16, weight: .heavy)).foregroundColor(loreTeal)
          Text("Play an episode and your\nrecent listens appear here")
            .font(.system(size: 10)).foregroundColor(loreMuted)
            .multilineTextAlignment(.center)
        }
      } else if family == .systemSmall {
        VStack(alignment: .leading, spacing: 6) {
          Text("LORE").font(.system(size: 9, weight: .heavy)).foregroundColor(loreTeal).kerning(1.2)
          Text(eps[0].title)
            .font(.system(size: 13, weight: .bold)).foregroundColor(loreInk).lineLimit(3)
          Spacer(minLength: 0)
          HStack {
            Text(eps[0].sender).font(.system(size: 9.5)).foregroundColor(loreMuted).lineLimit(1)
            Spacer()
            Image(systemName: "play.circle.fill").font(.system(size: 20)).foregroundColor(loreTeal)
          }
        }
      } else {
        VStack(alignment: .leading, spacing: 7) {
          Text("RECENTLY ON LORE").font(.system(size: 9, weight: .heavy)).foregroundColor(loreTeal).kerning(1.2)
          ForEach(eps.prefix(3)) { ep in
            EpisodeRow(ep: ep)
          }
          Spacer(minLength: 0)
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(lorePaper, for: .widget)
    .widgetURL(URL(string: "lore://home"))
  }
}

// ── Widget declaration ──────────────────────────────────────────────────────

struct LoreWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LoreWidget", provider: LoreProvider()) { entry in
      LoreWidgetView(entry: entry)
    }
    .configurationDisplayName("Lore — Recent Episodes")
    .description("Jump back into your latest newsletter episodes.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct LoreWidgetBundle: WidgetBundle {
  var body: some Widget {
    LoreWidget()
  }
}
