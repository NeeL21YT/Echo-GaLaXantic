// The black, voice-first view. Everything here is also spoken or announced, never visual-only.
import { getLevelTitleLine, stretchLabel } from './labels';
import { useEcho } from '../state/store';

export function BlindView() {
  const message = useEcho((s) => s.message);
  const levelId = useEcho((s) => s.levelId);
  const trialIndex = useEcho((s) => s.trialIndex);
  const trialCount = useEcho((s) => s.trialCount);
  const stretch = useEcho((s) => s.settings.stretch);
  const micOn = useEcho((s) => s.micOn);

  return (
    <section className="blind-view" aria-label="Echo">
      <p className="blind-message">{message || 'Echo'}</p>
      <p className="blind-status">
        {getLevelTitleLine(levelId, trialIndex, trialCount)}
        {levelId !== null && ' · '}Echo speed: {stretchLabel(stretch)}
        {micOn && <span className="mic-on"> · Mic on</span>}
      </p>
    </section>
  );
}
