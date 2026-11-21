// The teaching track (§13.7). Each lesson explains one skill in short spoken pages, plays contrasting examples
// through the same engine as the levels, and ends by pointing at the level that practises it.
// Wording follows CLAUDE.md: short, concrete, spoken-friendly, never a navigation or clinical claim.
import { corridor, frontWall, room, singleWall } from '../engine/worlds';
import { CLICK_COACH } from '../config';
import type { Pose, World } from '../types';
import type { LevelDef } from './types';

type LevelId = LevelDef['id'];

export type LessonStep =
  | { kind: 'say'; text: string }
  /** The learner clicks with their tongue and Echo judges each click from the mic until `goodNeeded` are good. */
  | { kind: 'coach'; goodNeeded: number }
  | { kind: 'demo'; label: string; world: World; pose: Pose };

/** One page is played in order, then waits for Continue. "Hear again" replays the page. */
export type LessonPage = LessonStep[];

export interface LessonDef {
  id: number;
  title: string;
  /** Level that practises this skill; null for lessons about technique or real rooms. */
  practiceLevel: LevelId | null;
  pages: LessonPage[];
}

const AHEAD: Pose = { p: { x: 0, y: 0 }, headingDeg: 0 };
const say = (text: string): LessonStep => ({ kind: 'say', text });
const demo = (label: string, world: World, pose: Pose = AHEAD): LessonStep => ({ kind: 'demo', label, world, pose });

export const LESSONS: LessonDef[] = [
  {
    id: 1,
    title: 'Make your click',
    practiceLevel: null,
    pages: [
      [
        say('Echolocation means listening to the echoes of your own sounds. Sound bounces off walls and objects and comes back to your ears.'),
        say('You already notice this. A bathroom sounds different from a bedroom. This course trains you to notice it on purpose.'),
      ],
      [
        say('First, your click. Rest the tip of your tongue just behind your top front teeth. Pull it down sharply, like saying tck.'),
        say('Keep it short and sharp, not loud. A short click gives a clear echo.'),
      ],
      [
        say('Now you try. Hold the phone about a hand away and click with your tongue, slowly, once a second. I will listen and tell you how each click sounds.'),
        { kind: 'coach', goodNeeded: CLICK_COACH.goodNeeded },
      ],
      [
        say('One more tip. Keep your head still while you click, and turn it slowly between clicks. Your ears hear best in the direction your head points.'),
        say('Next lesson: what an echo can tell you.'),
      ],
    ],
  },
  {
    id: 2,
    title: 'Which side is the wall',
    practiceLevel: 1,
    pages: [
      [
        say('A wall close to your left ear sends the echo back to your left ear first, and louder. Here is a wall on your left.'),
        demo('Wall on your left', singleWall('left', 1.2)),
        say('Now a wall on your right.'),
        demo('Wall on your right', singleWall('right', 1.2)),
      ],
      [
        say('Hear the difference? The sound leans toward the wall. Listen for which ear gets the bigger, earlier echo.'),
        say('Press Hear again to repeat the examples, or Continue.'),
      ],
      [say('Now practise. Level 1 plays one wall and asks Left or Right. After every answer I tell you what to listen for.')],
    ],
  },
  {
    id: 3,
    title: 'Near and far',
    practiceLevel: 2,
    pages: [
      [
        say('A close wall comes back sooner, louder and brighter. Here is a wall one metre ahead.'),
        demo('Wall one metre ahead', frontWall(1)),
        say('Now a wall three metres ahead.'),
        demo('Wall three metres ahead', frontWall(3)),
      ],
      [
        say('Close is loud and bright. Far is soft and dull, and its echo takes longer to arrive.'),
        say('While you learn, Echo slows the echoes down so you can hear that delay. As you improve, the slowdown is taken away, until it is real speed.'),
      ],
      [say('Now practise. Level 2 asks whether the wall is near or far.')],
    ],
  },
  {
    id: 4,
    title: 'Doorways are silence',
    practiceLevel: 3,
    pages: [
      [
        say('A doorway is a gap in a wall, and a gap sends nothing back. You hear it as silence. First, a solid wall ahead.'),
        demo('Solid wall ahead', room(4, 4)),
        say('Now a doorway straight ahead.'),
        demo('Doorway ahead', room(4, 4, [{ wall: 'N', center: 0, width: 1.2 }])),
      ],
      [
        say('Hear the hole in the sound? The front feels hollow. Turn your head until you find that hollow spot.'),
        say('Press Hear again to compare once more, or Continue.'),
      ],
      [say('Now practise. Level 3 hides a doorway in the room. Turn, click, and face the quiet gap.')],
    ],
  },
  {
    id: 5,
    title: 'Poles and moving',
    practiceLevel: 4,
    pages: [
      [
        say('A thin pole is small, so its echo is short and faint. But it stands out from the walls. First, an empty corridor.'),
        demo('Empty corridor', corridor(2, 10)),
        say('Now the same corridor with a pole two metres ahead.'),
        demo('Pole ahead', corridor(2, 10, [{ x: 0, y: 2 }])),
      ],
      [
        say('Hear the small extra echo? That is the pole.'),
        say('When you walk, take small steps and click at every step. If the sound suddenly gets louder, stop. Something is close.'),
      ],
      [say('Now practise. Level 4 asks you to find a pole. Level 5 asks you to walk out of a corridor.')],
    ],
  },
  {
    id: 6,
    title: 'Practise in a real room',
    practiceLevel: null,
    pages: [
      [
        say('Now take it into a real room. Choose a room you know well, with a clear floor. Practise with a friend nearby, or with your cane.'),
        say('Echo is for practice. Keep using your cane, guide or other tools to get around.'),
      ],
      [
        say('Stand about an arm\'s length from a wall, facing it. Click. Remember how it sounds.'),
        say('Step back one small step and click again. Notice how the echo gets softer and duller. Repeat, one step at a time.'),
      ],
      [
        say('Next, stand in a doorway or beside one. Click while you turn your head slowly. Listen for the hollow spot where the open space is.'),
        say('Check with your hand or your friend. Checking is how your ear learns.'),
      ],
      [
        say('Practise for five minutes a day. Short, regular practice works better than one long session.'),
        say('You have finished the lessons. Go back to the levels any time to keep your ear sharp.'),
      ],
    ],
  },
];

export function getLesson(id: number): LessonDef {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new Error(`No lesson ${id}`);
  return lesson;
}
