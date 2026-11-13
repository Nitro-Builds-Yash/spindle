/**
 * Browser-native Web Speech API helper for Spindle.
 * Provides zero-dependency Text-to-Speech (TTS) and Speech-to-Text (STT).
 */

export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak given text aloud using the best available Indian English voice */
export function speakText(text, { onStart, onEnd, onError, rate = 1.0 } = {}) {
  if (!isSpeechSynthesisSupported() || !text) return;

  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices() || [];
    // Prioritize Indian English voices (e.g. Google Indian English, Rishi, Neerja, en-IN)
    const voice =
      voices.find((v) => v.lang === "en-IN" || v.name.toLowerCase().includes("india")) ||
      voices.find((v) => v.lang.startsWith("en-")) ||
      voices[0];

    if (voice) utterance.voice = voice;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.warn("Speech synthesis error:", err);
    if (onError) onError(err);
  }
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/** Start speech recognition for live caller dictation */
export function createSpeechRecognizer({ onResult, onEnd, onError, onStart }) {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new SpeechRecognition();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = "en-IN";

    if (onStart) recognizer.onstart = onStart;

    recognizer.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript && onResult) onResult(transcript);
    };

    recognizer.onerror = (err) => {
      console.warn("Speech recognition error:", err);
      if (onError) onError(err);
    };

    recognizer.onend = () => {
      if (onEnd) onEnd();
    };

    return recognizer;
  } catch (err) {
    console.warn("Could not create speech recognizer:", err);
    return null;
  }
}
