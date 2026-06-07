import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiUpdateSession } from "@/lib/queryClient";
import { getPrompt, buildRecapText, CBT_STAGES, STAGE_LABELS, type CbtStage, COGNITIVE_PATTERNS, SESSION_TAGS } from "@/lib/prompts";
import { useSpeech } from "@/hooks/use-speech";
import { useSpeak } from "@/hooks/use-speak";
import { getRecap } from "@/lib/db";
import type { SessionRecord } from "@/lib/db";
import { ChevronLeft, ChevronRight, Tag, Save, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message { role: "assistant" | "user"; content: string; }

export default function SessionScreen() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [sessionData, setSessionData] = useState<Partial<SessionRecord>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cogPattern, setCogPattern] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handleSendRef = useRef<(text?: string) => void>(() => {});

  const { state: speakState, speak, stop: stopSpeaking } = useSpeak({
    lang: "en-GB", rate: 0.92,
    onEnd: () => { if (voiceEnabled && !isEnding) startListening(); },
  });
  const isSpeaking = speakState === "speaking";

  const { state: speechState, start: startListening, stop: stopListening, toggle: toggleListening } = useSpeech({
    onResult: (t) => { setLiveTranscript(t); setInput(t); },
    onAutoSend: (t) => handleSendRef.current(t),
    autoSend: voiceEnabled, lang: "en-GB",
  });
  const isListening = speechState === "listening";
  const micUnsupported = speechState === "unsupported";
  const ttsUnsupported = speakState === "unsupported";

  useEffect(() => {
    getRecap().then((recap) => {
      const recapText = buildRecapText({ lastSituation: recap.last?.situation, lastThought: recap.last?.main_thought, lastAction: recap.last?.next_action, topTag: recap.topTag, unfinishedAction: recap.unfinished?.next_action });
      const openMsg = recap.last ? `${recapText}\n\n${getPrompt("situation")}` : getPrompt("situation");
      setMessages([{ role: "assistant", content: openMsg }]);
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, liveTranscript]);

  function save(updates: Partial<SessionRecord>) {
    apiUpdateSession(sessionId, updates).then(() => qc.invalidateQueries({ queryKey: ["recap"] }));
  }

  const handleSend = useCallback((textOverride?: string) => {
    const userMsg = (textOverride ?? input).trim();
    if (!userMsg) return;
    setInput(""); setLiveTranscript("");
    stopListening();

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    const stage = CBT_STAGES[stageIdx] ?? "action";
    const updates: Partial<SessionRecord> = {};
    if (stage === "situation") updates.situation = userMsg;
    else if (stage === "thought") updates.main_thought = userMsg;
    else if (stage === "emotion") {
      const match = userMsg.match(/\b(10|[0-9])\b/);
      updates.emotion = userMsg.replace(/\b(10|[0-9])\b/, "").trim() || userMsg;
      if (match) updates.emotion_intensity = parseFloat(match[0]);
    } else if (stage === "alternative") updates.alternative_thought = userMsg;
    else if (stage === "action") updates.next_action = userMsg;

    const merged = { ...sessionData, ...updates };
    setSessionData(merged);
    save({ ...updates, messages: JSON.stringify(newMessages) });

    const nextIdx = stageIdx + 1;
    if (nextIdx >= CBT_STAGES.length) {
      setIsEnding(true); setShowMeta(true);
      const summary = buildSummary(merged);
      const closingText = `Good session. Here's what we landed on: ${summary} Anything to add before saving?`;
      const closing: Message = { role: "assistant", content: `Good session. Here's what we landed on:\n\n${summary}\n\nAnything to add before saving?` };
      setMessages([...newMessages, closing]);
      save({ ...updates, summary, messages: JSON.stringify([...newMessages, closing]) });
      if (voiceEnabled) speak(closingText);
      return;
    }

    setStageIdx(nextIdx);
    const nextPrompt = getPrompt(CBT_STAGES[nextIdx]);
    const withResponse = [...newMessages, { role: "assistant" as const, content: nextPrompt }];
    setMessages(withResponse);
    save({ messages: JSON.stringify(withResponse) });
    if (voiceEnabled) speak(nextPrompt);
  }, [input, messages, stageIdx, sessionData, stopListening, voiceEnabled, speak]);

  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  function buildSummary(data: Partial<SessionRecord>) {
    const parts = [];
    if (data.situation) parts.push(`Situation: ${data.situation}.`);
    if (data.main_thought) parts.push(`Thought: "${data.main_thought}".`);
    if (data.emotion) parts.push(`Feeling: ${data.emotion}${data.emotion_intensity ? ` (${data.emotion_intensity}/10)` : ""}.`);
    if (data.alternative_thought) parts.push(`Balanced thought: ${data.alternative_thought}.`);
    if (data.next_action) parts.push(`Next action: ${data.next_action}.`);
    return parts.join(" ");
  }

  async function handleSave() {
    const summary = buildSummary(sessionData);
    await apiUpdateSession(sessionId, { summary, tags: JSON.stringify(selectedTags), cognitive_pattern: cogPattern || undefined, is_complete: true, follow_up_status: "not_done", next_time_prompt: sessionData.next_action ? `Did you manage to: ${sessionData.next_action}?` : undefined });
    qc.invalidateQueries({ queryKey: ["recap"] });
    navigate("/");
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto" data-testid="session-screen">
      <div className="flex items-center gap-3 px-5 pt-10 pb-3">
        <button onClick={() => { stopSpeaking(); stopListening(); navigate("/"); }} className="tap-target opacity-60 hover:opacity-100"><ChevronLeft size={22} /></button>
        <div className="flex-1">
          <div className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)", fontFamily: "var(--font-display)" }}>Short session</div>
          <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{STAGE_LABELS[CBT_STAGES[stageIdx] ?? "action"]}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{stageIdx + 1}/{CBT_STAGES.length}</span>
          {!ttsUnsupported && (
            <button onClick={() => { if (isSpeaking) stopSpeaking(); if (isListening) stopListening(); setVoiceEnabled(v => !v); }} className="tap-target opacity-60 hover:opacity-100">
              {voiceEnabled ? <Volume2 size={18} className="text-primary" /> : <VolumeX size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-full overflow-hidden" style={{ height: "3px", background: "hsl(var(--muted))" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((stageIdx / CBT_STAGES.length) * 100, 100)}%`, background: "hsl(var(--session-accent))" }} />
      </div>

      <div className="flex-1 px-5 py-2 flex flex-col gap-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`fade-up ${msg.role === "assistant" ? "self-start" : "self-end"} max-w-[85%]`}>
            {msg.role === "assistant" ? (
              <div className="bubble-assistant px-4 py-3"><p className="text-foreground" style={{ fontSize: "var(--text-base)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{msg.content}</p></div>
            ) : (
              <div className="bubble-user px-4 py-3"><p style={{ fontSize: "var(--text-base)", lineHeight: 1.5 }}>{msg.content}</p></div>
            )}
          </div>
        ))}
        {isListening && liveTranscript && (
          <div className="self-end max-w-[85%] fade-up">
            <div className="bubble-user px-4 py-3 opacity-60"><p className="italic" style={{ fontSize: "var(--text-base)" }}>{liveTranscript}…</p></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showMeta && isEnding && (
        <div className="mx-5 mb-4 rounded-xl border border-border bg-card p-4 fade-up">
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}><Tag size={12} />Tags</div>
            <div className="flex flex-wrap gap-2">
              {SESSION_TAGS.map((tag) => (
                <button key={tag} onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className="px-2.5 py-1 rounded-full transition-all" style={{ background: selectedTags.includes(tag) ? "hsl(var(--primary))" : "hsl(var(--muted))", color: selectedTags.includes(tag) ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))", fontSize: "var(--text-xs)" }}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <Select onValueChange={setCogPattern}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Cognitive pattern (optional)" /></SelectTrigger>
            <SelectContent>{COGNITIVE_PATTERNS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {voiceEnabled && (
        <div className="text-center pb-2 h-5" style={{ fontSize: "var(--text-xs)", color: "hsl(var(--primary))" }}>
          {isSpeaking && <span className="pulse-soft">Speaking…</span>}
          {isListening && <span className="pulse-soft">Listening — pause to send</span>}
        </div>
      )}

      {!isEnding ? (
        <div className="px-5 pb-10 pt-2">
          <div className="rounded-2xl border flex items-end gap-3 p-3 transition-colors" style={{ borderColor: isListening ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <textarea data-testid="session-input" className="flex-1 bg-transparent outline-none resize-none text-foreground" style={{ fontSize: "var(--text-base)", minHeight: "44px", maxHeight: "160px", lineHeight: 1.5 }} placeholder={isListening ? "Listening…" : "Type or tap mic…"} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} rows={2} />
            {!micUnsupported && (
              <button onClick={() => { if (isSpeaking) { stopSpeaking(); startListening(); } else toggleListening(); }} className="tap-target rounded-xl flex items-center justify-center transition-all active:scale-95 relative" style={{ width: "44px", height: "44px", background: isListening ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
                {isListening && <span className="absolute inset-0 rounded-xl" style={{ background: "hsl(var(--primary) / 0.25)", animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />}
                {isListening ? <MicOff size={18} className="text-primary-foreground relative" /> : <Mic size={18} className="text-muted-foreground relative" />}
              </button>
            )}
            <button onClick={() => handleSend()} className="tap-target rounded-xl flex items-center justify-center transition-all active:scale-95" style={{ width: "44px", height: "44px", background: input.trim() ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
              <ChevronRight size={20} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-10">
          <Button data-testid="btn-save-session" className="w-full tap-target gap-2" onClick={handleSave}>
            <Save size={16} />Save session
          </Button>
        </div>
      )}
      <style>{`@keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }`}</style>
    </div>
  );
}
