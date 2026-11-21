// Segment 4 placeholder: Start unlocks audio and goes to the level list. The full §9.5 flow arrives in Segment 6.
import { unlockAudio } from '../audio/context';
import { initNarrator } from '../speech/narrator';
import { goToLevelSelect } from '../state/runner';

export function Onboarding() {
  const start = async () => {
    await unlockAudio();
    initNarrator();
    await goToLevelSelect();
  };
  return (
    <div className="onboarding">
      <button type="button" onClick={() => void start()} autoFocus>
        Start
      </button>
    </div>
  );
}
