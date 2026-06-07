import { useCallback, useRef, useState } from "react";

export type SpeakState = "idle" | "speaking" | "unsupported";

interface UseSpeakOptions {
  lang?: string;
  rate?: number;   // 0.1–10, default 1
  pitch?: number;  // 0–2, default 1
  onEnd?: () => void; // called when utterance finishes
}

export function useSpeak({ lang = "en-GB", rate = 0.95, pitch = 1, onEnd }: UseSpeakOptions = {}) {
  const [state, setState] = useState<SpeakState>(() =>
    typeof window !== "undefined" && "speechSynthesis" in window ? "idle" : "unsupported"
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    // Cancel anything currently playing
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Pick the best available voice — prefer iOS Siri Premium/Enhanced voices
    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter((v) => v.lang.startsWith("en"));
    const preferred =
      enVoices.find((v) => v.name.includes("Premium")) ||
      enVoices.find((v) => v.name.includes("Enhanced")) ||
      enVoices.find((v) => v.name.includes("Neural")) ||
      enVoices.find((v) => v.name.includes("Natural")) ||
      enVoices.find((v) => v.name.includes("Samantha")) ||
      enVoices.find((v) => v.name.includes("Daniel")) ||  // iOS UK
      enVoices.find((v) => v.name.includes("Karen")) ||   // iOS AU
      enVoices.find((v) => v.name.includes("Google")) ||
      enVoices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setState("speaking");
    utterance.onend = () => {
      setState("idle");
      onEnd?.();
    };
    utterance.onerror = () => setState("idle");

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState("speaking");
  }, [lang, rate, pitch, onEnd]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  return { state, speak, stop };
}
