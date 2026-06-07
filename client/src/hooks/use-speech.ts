import { useState, useRef, useCallback } from "react";

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export type SpeechState = "idle" | "listening" | "processing" | "unsupported";

interface UseSpeechOptions {
  onResult: (transcript: string) => void;
  onAutoSend?: (transcript: string) => void; // called after a pause — auto-submits
  lang?: string;
  autoSend?: boolean; // if true, submits after silence
}

export function useSpeech({ onResult, onAutoSend, lang = "en-GB", autoSend = false }: UseSpeechOptions) {
  const [state, setState] = useState<SpeechState>(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    return SR ? "idle" : "unsupported";
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Stop any existing session
    recognitionRef.current?.abort();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = lang;
    recognition.continuous = true;       // keep listening through pauses
    recognition.interimResults = true;   // show live transcript
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => {
      setState("listening");
      finalTranscript = "";
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalTranscript += r[0].transcript;
        } else {
          interim = r[0].transcript;
        }
      }

      // Push live transcript to the input field
      onResult((finalTranscript + interim).trim());

      // Auto-send after 2 seconds of silence
      if (autoSend && onAutoSend) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const toSend = finalTranscript.trim();
          if (toSend) {
            setState("processing");
            recognition.stop();
            onAutoSend(toSend);
          }
        }, 2000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      setState("idle");
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setState((prev) => (prev === "processing" ? "processing" : "idle"));
    };

    recognition.start();
  }, [lang, autoSend, onResult, onAutoSend]);

  const toggle = useCallback(() => {
    if (state === "listening") {
      stop();
    } else {
      start();
    }
  }, [state, start, stop]);

  return { state, start, stop, toggle };
}
