import WidgetKit
import SwiftUI

// ── Shared state written by the app (lib/widget.ts via App Group) ───────────

struct WidgetEpisode: Codable, Identifiable {
  let id: String
  let title: String
  let sender: String
  let durationS: Int?
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
      episodes: [
        WidgetEpisode(id: "p1", title: "A Japanese Ritual to Improve Your Habits", sender: "Sahil Bloom", durationS: 660),
        WidgetEpisode(id: "p2", title: "How top PMs increase their leverage with AI", sender: "Lenny's Newsletter", durationS: 1020),
      ],
      updatedAt: 0
    ))
  }
  func getSnapshot(in context: Context, completion: @escaping (LoreEntry) -> Void) {
    completion(LoreEntry(date: Date(), state: readState()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<LoreEntry>) -> Void) {
    let entry = LoreEntry(date: Date(), state: readState())
    // App reloads timelines on every play/seed; hourly refresh is a fallback.
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
  }
}

// ── Brand ───────────────────────────────────────────────────────────────────

func hexColor(_ hex: UInt32) -> Color {
  Color(
    red: Double((hex >> 16) & 0xFF) / 255.0,
    green: Double((hex >> 8) & 0xFF) / 255.0,
    blue: Double(hex & 0xFF) / 255.0
  )
}

let accentGreen = hexColor(0x2FD076)
let cardTop = hexColor(0x0F5B43)
let cardBottom = hexColor(0x06231A)
let txtDim = Color.white.opacity(0.62)

let cardGradient = LinearGradient(
  colors: [cardTop, cardBottom],
  startPoint: .topLeading,
  endPoint: .bottomTrailing
)

// Deterministic per-sender cover colors — same palette + hash as the app's
// CoverArt component, so widget tiles match in-app artwork.
let coverPalette: [(UInt32, UInt32)] = [
  (0x0F6E56, 0x0A3D2B), (0x534AB7, 0x2E2870), (0xD85A30, 0x8F3417),
  (0xBA7517, 0x7A4A0C), (0x1E6091, 0x0F3B5C), (0x7B2D8E, 0x4A1657),
  (0x2C7A4B, 0x17472A), (0xB23A48, 0x6E1F29),
]

func coverColors(_ name: String) -> (Color, Color) {
  var h: Int32 = 0
  for u in name.unicodeScalars {
    h = Int32(truncatingIfNeeded: Int(u.value)) &+ ((h << 5) &- h)
  }
  let pair = coverPalette[Int(h.magnitude) % coverPalette.count]
  return (hexColor(pair.0), hexColor(pair.1))
}

func initials(_ name: String) -> String {
  let words = name.split(separator: " ").prefix(2)
  return words.map { String($0.prefix(1)).uppercased() }.joined()
}

func minutes(_ s: Int?) -> String? {
  guard let s = s, s > 0 else { return nil }
  return "\(max(1, s / 60)) min"
}

// ── Pieces ──────────────────────────────────────────────────────────────────

// The app's two-tone cover: base color + offset deeper disc + initials.
struct CoverTile: View {
  let sender: String
  let size: CGFloat
  var body: some View {
    let (base, deep) = coverColors(sender)
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.24, style: .continuous).fill(base)
      Circle()
        .fill(deep.opacity(0.7))
        .frame(width: size * 0.85, height: size * 0.85)
        .offset(x: size * 0.28, y: size * 0.28)
      Text(initials(sender))
        .font(.system(size: size * 0.34, weight: .heavy))
        .foregroundColor(.white)
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
  }
}

struct PlayCircle: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      Circle().fill(.white)
      Image(systemName: "play.fill")
        .font(.system(size: size * 0.42, weight: .bold))
        .foregroundColor(cardBottom)
        .offset(x: size * 0.04)
    }
    .frame(width: size, height: size)
  }
}

struct EpisodeRow: View {
  let ep: WidgetEpisode
  var body: some View {
    HStack(spacing: 9) {
      CoverTile(sender: ep.sender, size: 38)
      VStack(alignment: .leading, spacing: 2) {
        Text(ep.title)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.white)
          .lineLimit(2)
        Text(minutes(ep.durationS).map { "\(ep.sender) · \($0)" } ?? ep.sender)
          .font(.system(size: 9.5))
          .foregroundColor(txtDim)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
      PlayCircle(size: 26)
    }
  }
}

// ── Widget views ────────────────────────────────────────────────────────────

struct LoreWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: LoreEntry

  var body: some View {
    let eps = entry.state.episodes

    Group {
      if eps.isEmpty {
        VStack(spacing: 6) {
          Image(systemName: "headphones")
            .font(.system(size: 22, weight: .semibold))
            .foregroundColor(accentGreen)
          Text("Lore").font(.system(size: 15, weight: .heavy)).foregroundColor(.white)
          Text("Fresh episodes appear here")
            .font(.system(size: 10)).foregroundColor(txtDim)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else if family == .systemSmall {
        // Audible-style: cover top, bold title, play + duration bottom.
        VStack(alignment: .leading, spacing: 8) {
          HStack(alignment: .top) {
            CoverTile(sender: eps[0].sender, size: 40)
            Spacer()
            Image(systemName: "headphones")
              .font(.system(size: 12, weight: .semibold))
              .foregroundColor(accentGreen)
          }
          Text(eps[0].title)
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(.white)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
          Spacer(minLength: 0)
          HStack(spacing: 7) {
            PlayCircle(size: 28)
            if let m = minutes(eps[0].durationS) {
              Text(m).font(.system(size: 11, weight: .semibold)).foregroundColor(txtDim)
            }
            Spacer()
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      } else {
        // Apple-Podcasts-style: header + two rows.
        VStack(alignment: .leading, spacing: 9) {
          HStack {
            Text("UP NEXT ON LORE")
              .font(.system(size: 9.5, weight: .heavy))
              .kerning(1.1)
              .foregroundColor(accentGreen)
            Spacer()
            Image(systemName: "headphones")
              .font(.system(size: 11, weight: .semibold))
              .foregroundColor(txtDim)
          }
          ForEach(eps.prefix(2)) { ep in
            EpisodeRow(ep: ep)
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
    .padding(13)
    .containerBackground(cardGradient, for: .widget)
    .widgetURL(URL(string: "lore://home"))
  }
}

// ── Widget declaration ──────────────────────────────────────────────────────

struct LoreWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LoreWidget", provider: LoreProvider()) { entry in
      LoreWidgetView(entry: entry)
    }
    .configurationDisplayName("Lore — Up Next")
    .description("Your latest newsletter episodes, ready to play.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct LoreWidgetBundle: WidgetBundle {
  var body: some Widget {
    LoreWidget()
  }
}
