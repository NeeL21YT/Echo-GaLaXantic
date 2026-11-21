// The black, voice-first view. Everything here is also spoken or announced, never visual-only.
import { getLevelTitleLine, stretchLabel } from './labels';
import { useEcho } from '../state/store';

/** Short messages stay huge for low vision; long lesson passages step down so they fit without endless scrolling. */
export function messageLength(text: string): 'short' | 'medium' | 'long' {
  if (text.length <= 60) return 'short';
  return text.length <= 140 ? 'medium' : 'long';
}

export function BlindView() {
  const message = useEcho((s) => s.message);
  const levelId = useEcho((s) => s.levelId);
  const trialIndex = useEcho((s) => s.trialIndex);
  const trialCount = useEcho((s) => s.trialCount);
  const stretch = useEcho((s) => s.settings.stretch);
  const micOn = useEcho((s) => s.micOn);
  const title = getLevelTitleLine(levelId, trialIndex, trialCount);
  const text = message || 'Echo';

  return (
    <section className="blind-view" aria-label="Echo">
      <p className="blind-message" data-length={messageLength(text)}>
        {text}
      </p>
      <ul className="chips" aria-label="Status">
        {title && <li className="chip">{title}</li>}
        <li className="chip">Echo speed: {stretchLabel(stretch)}</li>
        {micOn && <li className="chip on">Mic on</li>}
      </ul>
    </section>
  );
}
