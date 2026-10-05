import { NextRequest, NextResponse } from "next/server";
import * as googleTTS from "google-tts-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text") || "";
  const lang = searchParams.get("lang") || "te";

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  try {
    // Get audio URLs and base64 for seamless playback on any device
    const audioUrls = googleTTS.getAllAudioUrls(text, {
      lang,
      slow: false,
      host: "https://translate.google.com",
      splitPunct: ".?!, ",
    });

    return NextResponse.json({
      success: true,
      audioUrls,
    });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate audio" },
      { status: 500 }
    );
  }
}
