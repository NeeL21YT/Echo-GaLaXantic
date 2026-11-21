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
  const title = getLevelTitleLine(levelId, trialIndex, trialCount);

  return (
    <section className="blind-view" aria-label="Echo">
      <p className="blind-message">{message || 'Echo'}</p>
      <ul className="chips" aria-label="Status">
        {title && <li className="chip">{title}</li>}
        <li className="chip">Echo speed: {stretchLabel(stretch)}</li>
        {micOn && <li className="chip on">Mic on</li>}
      </ul>
    </section>
  );
}
