// Thin bridge to the Android plugin (§13.1). Every function is safe on the web: it falls back or does nothing,
// so the browser build behaves exactly as before.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface EchoNativePlugin {
  isScreenReaderOn(): Promise<{ on: boolean }>;
  setVolumeKeysCaptured(options: { captured: boolean }): Promise<void>;
  vibrate(options: { pattern: number[] }): Promise<void>;
  cancelVibration(): Promise<void>;
  speak(options: { id: number; text: string; rate: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  exitApp(): Promise<void>;
  addListener(event: 'screenReaderChanged', fn: (data: { on: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'speechEnd', fn: (data: { id: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'backPressed', fn: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'volumeKey', fn: (data: { key: 'up' | 'down' }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<EchoNativePlugin>('EchoNative');

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Whether TalkBack or another touch-exploration screen reader is on. Unknown on the web, so false. */
export async function isScreenReaderOn(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Native.isScreenReaderOn()).on;
  } catch {
    return false;
  }
}

/** Calls back whenever the screen reader is switched on or off; returns an unsubscribe function. */
export function onScreenReaderChange(fn: (on: boolean) => void): () => void {
  if (!isNative()) return () => undefined;
  const handle = Native.addListener('screenReaderChanged', (d) => fn(d.on));
  return () => void handle.then((h) => h.remove());
}

export async function captureVolumeKeys(captured: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    await Native.setVolumeKeysCaptured({ captured });
  } catch {
    // Without the keys the buttons and gestures still work.
  }
}

export function onVolumeKey(fn: (key: 'up' | 'down') => void): () => void {
  if (!isNative()) return () => undefined;
  const handle = Native.addListener('volumeKey', (d) => fn(d.key));
  return () => void handle.then((h) => h.remove());
}

/** Vibrates with alternating on/off milliseconds starting with "on". Returns false when nothing can vibrate. */
export async function vibrate(pattern: number[]): Promise<boolean> {
  if (pattern.length === 0) return true;
  if (isNative()) {
    try {
      await Native.vibrate({ pattern });
      return true;
    } catch {
      return false;
    }
  }
  return typeof navigator !== 'undefined' && 'vibrate' in navigator ? navigator.vibrate(pattern) : false;
}

export async function cancelVibration(): Promise<void> {
  if (isNative()) {
    try {
      await Native.cancelVibration();
    } catch {
      // Nothing to cancel.
    }
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

// ---------- speech ----------
// Android WebView has no speechSynthesis, so on the phone the system text-to-speech engine speaks through the plugin.

const speechWaiting = new Map<number, () => void>();
let speechId = 0;
let speechListening = false;

function listenForSpeechEnd(): void {
  if (speechListening) return;
  speechListening = true;
  void Native.addListener('speechEnd', (d) => {
    speechWaiting.get(d.id)?.();
    speechWaiting.delete(d.id);
  });
}

/** Speaks through the phone's engine; resolves when it finishes or is cut off. Resolves at once if it cannot speak. */
export function nativeSpeak(text: string, rate: number): Promise<void> {
  listenForSpeechEnd();
  const id = ++speechId;
  return new Promise<void>((resolve) => {
    speechWaiting.set(id, resolve);
    Native.speak({ id, text, rate }).catch(() => {
      speechWaiting.delete(id);
      resolve();
    });
  });
}

/** Stops speech and releases everything waiting on it. */
export function nativeStopSpeaking(): void {
  const waiting = [...speechWaiting.values()];
  speechWaiting.clear();
  void Native.stopSpeaking().catch(() => undefined);
  for (const resolve of waiting) resolve();
}

export const nativeSpeechPending = (): boolean => speechWaiting.size > 0;

// ---------- back ----------

/** The phone's back button or back swipe. Native only; the plugin swallows it so JS decides what Back means. */
export function onBackPressed(fn: () => void): () => void {
  if (!isNative()) return () => undefined;
  const handle = Native.addListener('backPressed', fn);
  return () => void handle.then((h) => h.remove());
}

export async function exitApp(): Promise<void> {
  if (!isNative()) return;
  try {
    await Native.exitApp();
  } catch {
    // Nothing to close.
  }
}
