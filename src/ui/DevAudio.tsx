// Dev-only tuning page (?dev=audio): hear single echoes and the room test by ear. Not shipped in production.
import { useState } from 'react';
import { DEFAULT_STRETCH, MAX_RANGE_M, MIN_DIST_M, REFLECTANCE, TURN_DEG } from '../config';
import { unlockAudio } from '../audio/context';
import { play } from '../audio/player';
import { bump, correct, footstep, levelUp, lrTest, wrong } from '../audio/sfx';
import { bufferPeak, renderStimulus } from '../audio/stimulus';
import { buildEchoes, makeVoice } from '../engine/echoBuilder';
import { castRays } from '../engine/raycaster';
import { room } from '../engine/worlds';
import { turn } from '../engine/collision';
import type { EchoVoice, Hit, Pose } from '../types';
import { ObserverView } from './ObserverView';

const ROOM_TEST = room(6, 6, [{ wall: 'N', center: 0, width: 1 }]);

export function DevAudio() {
  const [d, setD] = useState(1);
  const [az, setAz] = useState(-90);
  const [stretch, setStretch] = useState(DEFAULT_STRETCH);
  const [includeDirect, setIncludeDirect] = useState(true);
  const [pose, setPose] = useState<Pose>({ p: { x: 0, y: 0 }, headingDeg: 0 });
  const [status, setStatus] = useState('Press a button. Wear headphones.');
  const [shot, setShot] = useState<{ hits: Hit[]; pose: Pose | null; id: number }>({ hits: [], pose: null, id: 0 });

  async function renderAndPlay(voices: EchoVoice[], label: string) {
    try {
      await unlockAudio();
      const buf = await renderStimulus(voices, { includeDirect });
      setStatus(`${label}: ${voices.length} voices, peak ${bufferPeak(buf).toFixed(3)}, ${(buf.duration * 1000).toFixed(0)} ms`);
      await play(buf);
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    }
  }

  const playSingle = () =>
    renderAndPlay([makeVoice(d, az, REFLECTANCE.wall, 1, stretch)], `Single echo d=${d} m az=${az}°`);

  const playRoom = () => {
    const hits = castRays(ROOM_TEST, pose);
    setShot((s) => ({ hits, pose, id: s.id + 1 }));
    return renderAndPlay(buildEchoes(hits, stretch), `Room test heading ${pose.headingDeg}° (${hits.length}/72 rays hit)`);
  };

  const sfx = async (fn: () => Promise<void>) => {
    await unlockAudio();
    await fn();
  };

  return (
    <main className="dev">
      <h1>Echo — audio dev page</h1>
      <p role="status">{status}</p>

      <fieldset>
        <legend>Single echo</legend>
        <label>
          Distance {d.toFixed(1)} m
          <input type="range" min={MIN_DIST_M} max={MAX_RANGE_M} step={0.1} value={d} onChange={(e) => setD(Number(e.target.value))} />
        </label>
        <label>
          Azimuth {az}°
          <input type="range" min={-180} max={180} step={5} value={az} onChange={(e) => setAz(Number(e.target.value))} />
        </label>
        <label>
          Stretch {stretch}×
          <input type="range" min={1} max={8} step={0.5} value={stretch} onChange={(e) => setStretch(Number(e.target.value))} />
        </label>
        <label>
          <input type="checkbox" checked={includeDirect} onChange={(e) => setIncludeDirect(e.target.checked)} /> Include direct click
        </label>
        <button type="button" onClick={playSingle}>
          Play single echo
        </button>
      </fieldset>

      <fieldset>
        <legend>Room test — 6 × 6 m, 1 m gap in the north wall, player at the centre</legend>
        <button type="button" onClick={() => setPose((p) => turn(p, -TURN_DEG))}>
          Turn left
        </button>
        <button type="button" onClick={() => setPose((p) => turn(p, TURN_DEG))}>
          Turn right
        </button>
        <button type="button" onClick={playRoom}>
          Room test (heading {pose.headingDeg}°)
        </button>
      </fieldset>
      <div className="dev-observer">
        <ObserverView world={ROOM_TEST} pose={pose} hits={shot.hits} rayPose={shot.pose} shotId={shot.id} />
      </div>

      <fieldset>
        <legend>Sound effects</legend>
        <button type="button" onClick={() => sfx(bump)}>Bump</button>
        <button type="button" onClick={() => sfx(correct)}>Correct</button>
        <button type="button" onClick={() => sfx(wrong)}>Wrong</button>
        <button type="button" onClick={() => sfx(levelUp)}>Level up</button>
        <button type="button" onClick={() => sfx(() => lrTest('left'))}>L test</button>
        <button type="button" onClick={() => sfx(() => lrTest('right'))}>R test</button>
        <button type="button" onClick={() => sfx(footstep)}>Footstep</button>
      </fieldset>
    </main>
  );
}
