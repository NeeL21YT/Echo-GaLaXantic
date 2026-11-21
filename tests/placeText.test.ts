import { describe, expect, it } from 'vitest';
import type { PlaceMark } from '../src/engine/placeMap';
import {
  markContradiction, markDone, markDuplicate, markPrompt, marksHere, placeAlreadySaved, placeMatched, placeSaved,
  PLACE_NOT_SAVED, placesAlike, placesFull, saveNeedsOneMorePing,
} from '../src/speech/placeText';

const mark = (over: Partial<PlaceMark> = {}): PlaceMark => ({ kind: 'wall', headingDeg: 0, distanceM: 2, ...over });

describe('markPrompt', () => {
  it('names the keys for keyboard users and the buttons for everyone else', () => {
    const keys = markPrompt('keys');
    expect(keys).toContain('Press 3 for a wall');
    expect(keys).toContain('6 for an obstacle');
    for (const style of ['touch', 'buttons'] as const) {
      expect(markPrompt(style)).not.toContain('Press');
      expect(markPrompt(style)).toContain('Choose');
    }
  });
});

describe('markDone', () => {
  it('says what was marked, which way it faces and how far it is', () => {
    expect(markDone('doorway', 0, 1.5)).toBe('A doorway or opening marked, straight ahead, one and a half metres.');
    expect(markDone('wall', 92, 2)).toBe('A wall marked, about ninety degrees to your right, two metres.');
    expect(markDone('step', -180, 1)).toBe('A step or drop marked, behind you, one metre.');
    expect(markDone('obstacle', -45, 0.5)).toBe('An obstacle marked, about forty-five degrees to your left, half a metre.');
  });

  it('says when the same thing is already marked there', () => {
    expect(markDuplicate('wall')).toBe('A wall is already marked here, at about the same distance.');
  });
});

describe('marksHere', () => {
  it('reads one mark as a sentence', () => {
    expect(marksHere([mark()])).toBe('Here you marked a wall, straight ahead, two metres.');
  });

  it('reads two marks without sounding like a list of numbers', () => {
    const text = marksHere([mark(), mark({ kind: 'doorway', headingDeg: 180, distanceM: 1 })]);
    expect(text).toBe('Here you marked a wall, straight ahead, two metres; and a doorway or opening, behind you, one metre.');
  });

  it('says nothing when there is nothing marked', () => {
    expect(marksHere([])).toBe('');
  });
});

describe('place claims', () => {
  it('names a recognised place without pretending to know where it is', () => {
    expect(placeMatched('Place one')).toBe('This looks like Place one.');
    expect(placeSaved('Place one')).toContain('Saved as Place one.');
    expect(placeAlreadySaved('Place one')).toContain('will not keep it twice');
  });

  it('refuses to choose between two places that sound alike', () => {
    const text = placesAlike('Place one', 'Place two');
    expect(text).toContain('Place one');
    expect(text).toContain('Place two');
    expect(text).toContain('will not guess');
  });

  it('explains the missing shape, the missing place and the full list', () => {
    expect(saveNeedsOneMorePing()).toContain('ping once more');
    expect(PLACE_NOT_SAVED).toContain('Save this place first');
    expect(placesFull(8)).toContain('eight places');
  });

  it('reports a changed measurement without claiming why it changed', () => {
    const text = markContradiction(mark({ kind: 'doorway', distanceM: 1 }), 2);
    expect(text).toBe('You marked a doorway or opening here at one metre; it now measures two metres.');
    expect(text).not.toMatch(/closed|gone|removed|moved/);
  });
});
