import { useEffect, useRef, useState } from 'react';
import { attachKeyboard } from './input/keyboard';
import { Announcer } from './speech/Announcer';
import { dispatch, validActions } from './state/runner';
import { useEcho, type Action } from './state/store';
import { BlindView } from './ui/BlindView';
import { Controls } from './ui/Controls';
import { DevAudio } from './ui/DevAudio';
import { LevelSelect } from './ui/LevelSelect';
import { ObserverView } from './ui/ObserverView';
import { Onboarding } from './ui/Onboarding';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

// Levels 1–3 are judged by ear, so the observer hides the room until the trial is answered.
const HIDDEN_UNTIL_ANSWERED = new Set([1, 2, 3]);

function useActionLabels(): Partial<Record<Action, string>> {
  const phase = useEcho((s) => s.phase);
  if (phase === 'intro') return { answer: 'Begin' };
  if (phase === 'ready') return { answer: 'Facing the door' };
  if (phase === 'summary') return { next: 'Level list' };
  return {};
}

export function App() {
  const practiceRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(false);
  const phase = useEcho((s) => s.phase);
  const levelId = useEcho((s) => s.levelId);
  const observer = useEcho((s) => s.settings.observer);
  const trial = useEcho((s) => s.trial);
  const pose = useEcho((s) => s.pose);
  const lastHits = useEcho((s) => s.lastHits);
  const lastPose = useEcho((s) => s.lastPose);
  const shotId = useEcho((s) => s.shotId);
  const clicks = useEcho((s) => s.clicksThisTrial);
  // Subscribing to these re-renders Controls when the valid actions change.
  useEcho((s) => s.lastResult);
  useEcho((s) => s.stretchOffer);
  const labels = useActionLabels();

  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    return attachKeyboard(el, dispatch);
  }, []);

  // Keys only work while the practice area has focus, so return focus to it on every phase change.
  useEffect(() => {
    if (phase !== 'onboarding') practiceRef.current?.focus();
    setReveal(false);
  }, [phase]);

  if (isDevAudio) return <DevAudio />;

  const actions = validActions();
  const answerActions: Action[] = ['left', 'right', 'near', 'far', 'answer'];
  const disabled = phase === 'ready' && clicks < 1 ? answerActions : [];
  const hideWorld =
    levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && !reveal;

  return (
    <div className={observer ? 'layout split' : 'layout'}>
      <div
        ref={practiceRef}
        className="practice"
        role="application"
        aria-label="Echo practice area. Press H for help."
        tabIndex={0}
      >
        <BlindView />
        {phase === 'onboarding' && <Onboarding />}
        {phase === 'levelSelect' && <LevelSelect />}
        <Controls actions={actions} onAction={dispatch} disabled={disabled} labels={labels} />
      </div>
      {observer && (
        <div className="observer-panel">
          <ObserverView
            world={trial?.world ?? null}
            pose={pose}
            hits={lastHits}
            rayPose={lastPose}
            shotId={shotId}
            hideWorld={hideWorld}
          />
          {levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && (
            <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
              {reveal ? 'Hide room' : 'Reveal room'}
            </button>
          )}
        </div>
      )}
      <Announcer />
    </div>
  );
}
