import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getPrompt, buildRecapText, DRIVE_STAGES, STAGE_LABELS, type CbtStage } from "@/lib/prompts";
import { useSpeech } from "@/hooks/use-speech";
import { useSpeak } from "@/hooks/use-speak";
import type { Session } from "@shared/schema";
import { ChevronLeft, Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecapData {
  last: Session | null;
  topTag: string | null;
  unfinished: Session | null;
}

interface Message {
  role: "assistant" | "user";
  content: string;
}

export default function DriveMode() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [sessionData, setSessionData] = useState<Partial<Session>>({});
  const [isEnding, setIsEnding] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [started, setStarted] = useState(false); // user must tap once to unlock audio
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep a ref to the latest handleSend so speech callbacks stay fresh
  const handleSendRef = useRef<(text: string) => void>(() => {});

  const { data: recap } = useQuery<RecapData>({
    queryKey: ["/api/sessions/recap"],
    queryFn: async () => (await apiRequest("GET", "/api/sessions/recap")).json(),
  });

  const updateSession = useMutation({
    mutationFn: async (data: Partial<Session>) =>
      (await apiRequest("PATCH", `/api/sessions/${id}`, data)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions"] }),
  });

  // ── TTS ──────────────────────────────────────────────────────────────────
  // After speaking finishes, start listening automatically
  const { state: speakState, speak, stop: stopSpeaking } = useSpeak({
    lang: "en-GB",
    rate: 0.92,
    onEnd: () => {
      if (!isEnding && voiceEnabled) startListening();
    },
  });

  // ── STT ──────────────────────────────────────────────────────────────────
  const { state: speechState, start: startListening, stop: stopListening, toggle: toggleListening } = useSpeech({
    onResult: (t) => setLiveTranscript(t),
    onAutoSend: (t) => handleSendRef.current(t),
    autoSend: true,
    lang: "en-GB",
  });

  const isListening = speechState === "listening";
  const isSpeaking = speakState === "speaking";
  const micUnsupported = speechState === "unsupported";
  const ttsUnsupported = speakState === "unsupported";

  // ── Opening recap ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recap || messages.length > 0) return;
    const recapText = buildRecapText({
      lastSituation: recap.last?.situation,
      lastThought: recap.last?.main_thought,
      lastAction: recap.last?.next_action,
      topTag: recap.topTag,
      unfinishedAction: recap.unfinished?.next_action,
    });
    setMessages([{ role: "assistant", content: recapText }]);
    // Don't auto-speak yet — user must tap "Start" first (browser audio policy)
  }, [recap]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  // ── Start session (unlocks audio, speaks recap) ───────────────────────────
  function handleStart() {
    setStarted(true);
    const firstMsg = messages[messages.length - 1];
    if (firstMsg && voiceEnabled) speak(firstMsg.content);
    else if (!voiceEnabled) startListening();
  }

  // ── Send a user response and advance the stage ────────────────────────────
  const handleSend = useCallback((userMsg: string) => {
    const text = userMsg.trim();
    if (!text) return;
    setLiveTranscript("");
    stopListening();

    setStageIdx((prevIdx) => {
      setMessages((prev) => {
        const newMessages: Message[] = [...prev, { role: "user", content: text }];

        const stage = DRIVE_STAGES[prevIdx] ?? "action";
        const updates: Partial<Session> = { messages: JSON.stringify(newMessages) };

        if (stage === "situation") updates.situation = text;
        else if (stage === "thought") updates.main_thought = text;
        else if (stage === "emotion") {
          const match = text.match(/\b(10|[0-9])\b/);
          updates.emotion = text.replace(/\b(10|[0-9])\b/, "").trim() || text;
          if (match) updates.emotion_intensity = parseFloat(match[0]);
        } else if (stage === "alternative") updates.alternative_thought = text;
        else if (stage === "action") updates.next_action = text;

        setSessionData((sd) => {
          const merged = { ...sd, ...updates };

          const nextIdx = prevIdx + 1;

          if (nextIdx >= DRIVE_STAGES.length) {
            // Session complete
            const summary = buildSummary(merged);
            const closing = "Good session. I've saved everything. Safe drive.";
            const finalMsgs = [...newMessages, { role: "assistant" as const, content: closing }];
            updateSession.mutate({
              ...updates,
              summary,
              is_complete: true,
              messages: JSON.stringify(finalMsgs),
              next_time_prompt: merged.next_action ? `Did you manage to: ${merged.next_action}?` : undefined,
            });
            setIsEnding(true);
            if (voiceEnabled) speak(closing);
            return finalMsgs as any; // handled below
          }

          const nextPrompt = getPrompt(DRIVE_STAGES[nextIdx]);
          const withResponse = [...newMessages, { role: "assistant" as const, content: nextPrompt }];
          updateSession.mutate({ messages: JSON.stringify(withResponse) });
          if (voiceEnabled) speak(nextPrompt);
          else startListening(); // text mode: go straight to listening
          return withResponse;
        });

        return newMessages; // intermediate — will be replaced by setSessionData callback above
      });

      return prevIdx + 1 < DRIVE_STAGES.length ? prevIdx + 1 : prevIdx;
    });
  }, [stopListening, updateSession, voiceEnabled, speak, startListening]);

  // Keep ref fresh
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  function buildSummary(data: Partial<Session>) {
    const parts = [];
    if (data.situation) parts.push(`Situation: ${data.situation}.`);
    if (data.main_thought) parts.push(`Thought: "${data.main_thought}".`);
    if (data.emotion) parts.push(`Feeling: ${data.emotion}${data.emotion_intensity ? ` (${data.emotion_intensity}/10)` : ""}.`);
    if (data.alternative_thought) parts.push(`Balanced thought: ${data.alternative_thought}.`);
    if (data.next_action) parts.push(`Next action: ${data.next_action}.`);
    return parts.join(" ");
  }

  function handleEnd() {
    stopSpeaking();
    stopListening();
    updateSession.mutate({ is_complete: false });
    qc.invalidateQueries({ queryKey: ["/api/sessions"] });
    navigate("/");
  }

  function handleRepeat() {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && voiceEnabled) speak(lastAssistant.content);
  }

  function toggleVoice() {
    if (isSpeaking) stopSpeaking();
    setVoiceEnabled((v) => !v);
  }

  const stage = DRIVE_STAGES[Math.min(stageIdx, DRIVE_STAGES.length - 1)];
  const stageLabel = STAGE_LABELS[stage];

  return (
    <div className="drive-mode min-h-dvh flex flex-col select-none" data-testid="drive-mode-screen">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <button
          data-testid="btn-end"
          onClick={handleEnd}
          className="tap-target flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
          style={{ fontSize: "var(--text-sm)", color: "hsl(var(--drive-text))" }}
        >
          <ChevronLeft size={18} />
          End
        </button>

        <div
          className="px-3 py-1 rounded-full opacity-70"
          style={{ fontSize: "var(--text-xs)", background: "hsl(var(--primary) / 0.25)", color: "hsl(var(--drive-text))" }}
        >
          {stageLabel}
        </div>

        {/* Voice toggle */}
        {!ttsUnsupported && (
          <button
            data-testid="btn-voice-toggle"
            onClick={toggleVoice}
            className="tap-target opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "hsl(var(--drive-text))" }}
            aria-label={voiceEnabled ? "Mute voice" : "Unmute voice"}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        )}
        {ttsUnsupported && <div className="w-10" />}
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 justify-center pb-8 px-5">
        {DRIVE_STAGES.map((s, i) => (
          <div
            key={s}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === stageIdx ? "20px" : "6px",
              height: "6px",
              background: i < stageIdx
                ? "hsl(var(--accent))"
                : i === stageIdx
                ? "hsl(var(--accent) / 0.8)"
                : "hsl(var(--drive-text) / 0.15)",
            }}
          />
        ))}
      </div>

      {/* Message display — last 2 messages only in drive mode */}
      <div className="flex-1 flex flex-col justify-end px-5 pb-4 gap-4 overflow-hidden">
        {messages.slice(-2).map((msg, i) => (
          <div
            key={i}
            className={`fade-up ${msg.role === "assistant" ? "self-start max-w-[90%]" : "self-end max-w-[80%]"}`}
          >
            {msg.role === "assistant" ? (
              <div className="bubble-assistant px-4 py-3">
                <p style={{ fontSize: "var(--text-base)", color: "hsl(var(--drive-text))", lineHeight: 1.55 }}>
                  {msg.content}
                </p>
              </div>
            ) : (
              <div className="bubble-user px-4 py-3">
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.5 }}>{msg.content}</p>
              </div>
            )}
          </div>
        ))}

        {/* Live transcript */}
        {isListening && liveTranscript && (
          <div className="self-end max-w-[80%] fade-up">
            <div className="bubble-user px-4 py-3 opacity-60">
              <p className="italic" style={{ fontSize: "var(--text-base)", lineHeight: 1.5 }}>
                {liveTranscript}…
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status indicator */}
      <div className="text-center pb-4 h-6" style={{ fontSize: "var(--text-xs)", color: "hsl(var(--accent))" }}>
        {isSpeaking && <span className="pulse-soft">Speaking…</span>}
        {isListening && <span className="pulse-soft">Listening — pause to send</span>}
        {!isSpeaking && !isListening && started && !isEnding && (
          <span className="opacity-40" style={{ color: "hsl(var(--drive-text))" }}>Tap mic to speak</span>
        )}
      </div>

      {/* ── Main control area ── */}
      {!started ? (
        /* First tap — unlocks browser audio */
        <div className="px-5 pb-14">
          <button
            data-testid="btn-start"
            onClick={handleStart}
            className="w-full tap-target rounded-2xl py-5 font-bold transition-all active:scale-95"
            style={{
              background: "hsl(var(--accent))",
              color: "hsl(var(--primary-foreground))",
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-base)",
            }}
          >
            {voiceEnabled ? "Tap to start — I'll speak first" : "Tap to start"}
          </button>
          <p className="text-center mt-3 opacity-40" style={{ fontSize: "var(--text-xs)", color: "hsl(var(--drive-text))" }}>
            {voiceEnabled
              ? "Questions will be read aloud. Speak your answers."
              : "Voice output off. Type or tap mic to respond."}
          </p>
        </div>

      ) : isEnding ? (
        /* Session done */
        <div className="px-5 pb-14">
          <Button
            data-testid="btn-done"
            className="w-full tap-target"
            onClick={() => navigate("/")}
            style={{ background: "hsl(var(--accent))", color: "hsl(var(--primary-foreground))" }}
          >
            Done — back home
          </Button>
        </div>

      ) : (
        /* Active session controls */
        <div className="px-5 pb-10">
          {/* Big mic button */}
          <div className="flex justify-center mb-5">
            <button
              data-testid="btn-mic"
              onClick={() => {
                if (isSpeaking) { stopSpeaking(); startListening(); }
                else toggleListening();
              }}
              disabled={micUnsupported}
              className="rounded-full flex items-center justify-center transition-all active:scale-95 relative"
              style={{
                width: "80px",
                height: "80px",
                background: isListening
                  ? "hsl(var(--accent))"
                  : "hsl(var(--primary) / 0.25)",
              }}
              aria-label={isListening ? "Stop listening" : "Start speaking"}
            >
              {isListening && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "hsl(var(--accent) / 0.25)",
                    animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
              )}
              {isListening
                ? <MicOff size={30} style={{ color: "white", position: "relative" }} />
                : <Mic size={30} style={{ color: "hsl(var(--drive-text))", position: "relative" }} />
              }
            </button>
          </div>

          {/* Repeat + End */}
          <div className="flex gap-3">
            <button
              data-testid="btn-repeat"
              onClick={handleRepeat}
              disabled={!voiceEnabled || ttsUnsupported}
              className="tap-target flex-1 rounded-xl flex items-center justify-center gap-2 opacity-60 hover:opacity-80 disabled:opacity-20"
              style={{
                border: "1px solid hsl(var(--drive-text) / 0.2)",
                color: "hsl(var(--drive-text))",
                fontSize: "var(--text-sm)",
              }}
            >
              <Volume2 size={16} />
              Repeat
            </button>
            <button
              data-testid="btn-end-session"
              onClick={handleEnd}
              className="tap-target flex-1 rounded-xl flex items-center justify-center gap-2 opacity-60 hover:opacity-80"
              style={{
                border: "1px solid hsl(var(--drive-text) / 0.2)",
                color: "hsl(var(--drive-text))",
                fontSize: "var(--text-sm)",
              }}
            >
              <Square size={16} />
              End session
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
