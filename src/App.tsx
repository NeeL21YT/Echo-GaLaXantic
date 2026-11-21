import { useEcho } from './state/store';
import type { Action } from './state/store';
import { BlindView } from './ui/BlindView';
import { Controls } from './ui/Controls';
import { DevAudio } from './ui/DevAudio';
import { ObserverView } from './ui/ObserverView';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

// Segment 3 shell: every button is shown; phase filtering arrives with the runner in Segment 4.
const ALL_ACTIONS: readonly Action[] = [
  'click', 'left', 'right', 'near', 'far', 'turnLeft', 'turnRight', 'stepForward', 'stepBack',
  'answer', 'replay', 'contrast', 'next', 'settings', 'observer',
];

export function App() {
  const observer = useEcho((s) => s.settings.observer);
  const setSettings = useEcho((s) => s.setSettings);
  const trial = useEcho((s) => s.trial);
  const pose = useEcho((s) => s.pose);
  const lastHits = useEcho((s) => s.lastHits);
  const lastPose = useEcho((s) => s.lastPose);
  const shotId = useEcho((s) => s.shotId);

  if (isDevAudio) return <DevAudio />;

  const onAction = (a: Action) => {
    if (a === 'observer') setSettings({ observer: !observer });
  };

  return (
    <div className={observer ? 'layout split' : 'layout'}>
      <div className="practice">
        <BlindView />
        <Controls actions={ALL_ACTIONS} onAction={onAction} />
      </div>
      {observer && (
        <ObserverView world={trial?.world ?? null} pose={pose} hits={lastHits} rayPose={lastPose} shotId={shotId} />
      )}
    </div>
  );
}
