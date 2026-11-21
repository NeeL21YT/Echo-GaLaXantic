// speechSynthesis wrapper for voice narration mode (§9.4). Never used in screen-reader mode.
import { NARRATION } from '../config';
import { isNative, nativeSpeak, nativeSpeechPending, nativeStopSpeaking } from '../native/echoNative';

type Pending = { utter: SpeechSynthesisUtterance; resolve: () => void };

const pending = new Set<Pending>();
let voice: SpeechSynthesisVoice | null = null;

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

// Prefer a local (offline) English voice so narration still works with the network off.
function pickVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const english = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith(NARRATION.lang));
  return english.find((v) => v.localService && v.default) ?? english.find((v) => v.localService) ?? english[0] ?? null;
}

export function initNarrator(): void {
  const s = synth();
  if (!s) return;
  voice = pickVoice();
  s.addEventListener('voiceschanged', () => {
    voice = pickVoice();
  });
}

export function isSpeechAvailable(): boolean {
  return isNative() || synth() !== null;
}

/** Speaks text; resolves when it finishes or is cancelled. */
export function speak(text: string): Promise<void> {
  // The Android web view has no speechSynthesis; the phone's own engine speaks instead.
  if (isNative()) return text ? nativeSpeak(text, NARRATION.rate) : Promise.resolve();
  const s = synth();
  if (!s || !text) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = NARRATION.rate;
    utter.lang = voice?.lang ?? NARRATION.lang;
    if (voice) utter.voice = voice;
    const entry: Pending = { utter, resolve };
    const done = () => {
      if (pending.delete(entry)) resolve();
    };
    utter.onend = done;
    utter.onerror = done;
    pending.add(entry);
    s.speak(utter);
  });
}

/** Stops all speech. Chrome doesn't always fire onend after cancel(), so pending promises are settled here. */
export function cancel(): void {
  if (isNative()) nativeStopSpeaking();
  synth()?.cancel();
  for (const entry of pending) entry.resolve();
  pending.clear();
}

export function isSpeaking(): boolean {
  if (isNative()) return nativeSpeechPending();
  const s = synth();
  return pending.size > 0 || (s !== null && (s.speaking || s.pending));
}

/** Resolves once nothing is speaking, so a stimulus never overlaps speech. */
export function awaitIdle(): Promise<void> {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (!isSpeaking()) resolve();
      else setTimeout(check, NARRATION.idlePollMs);
    };
    check();
  });
}
