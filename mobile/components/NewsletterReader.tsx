import { createElement, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../lib/theme";
import { CONTENT } from "../lib/responsive";
import { episodeDate } from "../lib/format";
import { ContentBlock, Episode } from "../lib/types";
import { fetchRawHtml } from "../lib/gmail";
import Avatar from "./Avatar";

type Mode = "reader" | "original";

// Fall back to paragraph blocks when an episode predates structured content.
function blocksFor(ep: Episode): ContentBlock[] {
  if (ep.blocks && ep.blocks.length) return ep.blocks;
  const src = ep.raw_text ?? "";
  return src
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ type: "text" as const, text }));
}

// Image that sizes itself to its natural aspect ratio (RN needs an explicit
// height; Image.getSize gives us the ratio so newsletter art isn't distorted).
function AutoImage({ src, alt }: { src: string; alt?: string }) {
  const [ratio, setRatio] = useState(1.6);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Image.getSize(
      src,
      (w, h) => { if (live && h > 0) setRatio(w / h); },
      () => { if (live) setFailed(true); }
    );
    return () => { live = false; };
  }, [src]);
  if (failed) return null;
  return (
    <View style={s.imageWrap}>
      <Image source={{ uri: src }} style={{ width: "100%", aspectRatio: ratio }} resizeMode="cover" />
      {!!alt && <Text style={s.caption}>{alt}</Text>}
    </View>
  );
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return <Text style={s.heading}>{block.text}</Text>;
    case "quote":
      return (
        <View style={s.quote}>
          <Text style={s.quoteText}>{block.text}</Text>
        </View>
      );
    case "image":
      return <AutoImage src={block.src} alt={block.alt} />;
    default:
      return <Text style={s.paragraph}>{block.text}</Text>;
  }
}

// Web-only raw-HTML frame for the "original" mode. Sandboxed with no script
// execution; same-origin so inline CSS + images render like the real email.
function OriginalFrame({ html }: { html: string }) {
  if (Platform.OS !== "web") {
    return <Text style={s.notice}>The original email view is available on the web app.</Text>;
  }
  return createElement("iframe", {
    srcDoc: html,
    sandbox: "allow-same-origin allow-popups",
    style: { width: "100%", height: "100%", border: "none", background: "#fff" },
  });
}

export default function NewsletterReader({
  episode,
  token,
  onClose,
}: {
  episode: Episode;
  token: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("reader");
  const [html, setHtml] = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  const canViewOriginal = !!episode.gmail_message_id && !!token;
  const blocks = blocksFor(episode);

  useEffect(() => {
    if (mode !== "original" || html || !episode.gmail_message_id || !token) return;
    setLoadingHtml(true);
    setHtmlError(null);
    fetchRawHtml(episode.gmail_message_id, token)
      .then((h) => (h ? setHtml(h) : setHtmlError("Couldn't load the original email.")))
      .catch(() => setHtmlError("Couldn't load the original email."))
      .finally(() => setLoadingHtml(false));
  }, [mode, episode.gmail_message_id, token, html]);

  return (
    <View style={s.wrap}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.bg }}>
        <View style={s.topBar}>
          <Pressable onPress={onClose} hitSlop={10} style={s.back}>
            <Text style={s.backTxt}>‹ Back</Text>
          </Pressable>
          {canViewOriginal && (
            <View style={s.toggle}>
              <Pressable
                onPress={() => setMode("reader")}
                style={[s.toggleBtn, mode === "reader" && s.toggleBtnOn]}
              >
                <Text style={[s.toggleTxt, mode === "reader" && s.toggleTxtOn]}>Reader</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("original")}
                style={[s.toggleBtn, mode === "original" && s.toggleBtnOn]}
              >
                <Text style={[s.toggleTxt, mode === "original" && s.toggleTxtOn]}>Original</Text>
              </Pressable>
            </View>
          )}
          <View style={{ width: 52 }} />
        </View>
      </SafeAreaView>

      {mode === "original" ? (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {loadingHtml && (
            <View style={s.center}><ActivityIndicator color={C.teal} /></View>
          )}
          {htmlError && !loadingHtml && <Text style={s.notice}>{htmlError}</Text>}
          {html && !loadingHtml && <OriginalFrame html={html} />}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.article}>
            {/* Article header */}
            <View style={s.head}>
              <View style={s.headRow}>
                <Avatar name={episode.sender_name} url={episode.sender_logo_url} size={28} />
                <Text style={s.sender} numberOfLines={1}>{episode.sender_name}</Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.date}>{episodeDate(episode.received_at)}</Text>
              </View>
              <Text style={s.title}>{episode.subject}</Text>
            </View>
            {blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
            <View style={{ height: 60 }} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  back: { width: 52 },
  backTxt: { fontSize: 15, fontWeight: "700", color: C.teal },
  toggle: {
    flexDirection: "row", backgroundColor: C.surface, borderRadius: RADIUS.pill, padding: 3,
  },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill },
  toggleBtnOn: { backgroundColor: C.white, ...(SHADOW.card as object) },
  toggleTxt: { fontSize: 13, fontWeight: "600", color: C.muted },
  toggleTxtOn: { color: C.ink },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  notice: { fontSize: 14, color: C.muted, textAlign: "center", padding: 32 },

  content: { paddingHorizontal: 20, paddingTop: 8 },
  article: { width: "100%", maxWidth: CONTENT.feed, alignSelf: "center" },

  head: { gap: 10, marginBottom: 18 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sender: { fontSize: 13, fontWeight: "700", color: C.ink },
  dot: { color: C.muted },
  date: { fontSize: 13, color: C.muted, fontWeight: "500" },
  title: { fontSize: 28, fontWeight: "700", color: C.ink, lineHeight: 36, fontFamily: SERIF },

  heading: { fontSize: 20, fontWeight: "700", color: C.ink, lineHeight: 27, fontFamily: SERIF, marginTop: 22, marginBottom: 2 },
  paragraph: { fontSize: 16.5, color: C.ink, lineHeight: 27, marginTop: 14 },
  quote: {
    borderLeftWidth: 3, borderLeftColor: C.teal, paddingLeft: 14, marginTop: 16, marginVertical: 4,
  },
  quoteText: { fontSize: 17, fontStyle: "italic", color: C.muted, lineHeight: 26 },
  imageWrap: {
    marginTop: 18, borderRadius: RADIUS.card, overflow: "hidden", backgroundColor: C.surface,
  },
  caption: { fontSize: 12, color: C.muted, padding: 8, textAlign: "center" },
});
