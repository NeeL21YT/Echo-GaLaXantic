import { describe, expect, it } from 'vitest';
import { PLACES } from '../src/config';
import {
  addMark, contradicted, marksAt, matchPlaces, placeHeading, placeLabel, toPlaceReadings,
  type Place, type PlaceMark,
} from '../src/engine/placeMap';

/** A saved spot: three facings, as if the learner pinged three ways from one place. */
const kitchen = (marks: PlaceMark[] = []): Place => ({
  id: 'p1',
  label: 'Place one',
  readings: [
    { headingDeg: 0, distanceM: 2 },
    { headingDeg: 90, distanceM: 1.5 },
    { headingDeg: 180, distanceM: 4 },
  ],
  marks,
});

describe('toPlaceReadings', () => {
  it('makes headings relative to the first facing of the visit', () => {
    const out = toPlaceReadings([
      { headingDeg: 100, distanceM: 2 },
      { headingDeg: 190, distanceM: 1.5 },
    ]);
    expect(out[0]?.headingDeg).toBe(0);
    expect(out[1]?.headingDeg).toBeCloseTo(90, 5);
    expect(out[1]?.distanceM).toBe(1.5);
  });

  it('is empty when nothing was measured', () => {
    expect(toPlaceReadings([])).toEqual([]);
  });
});

describe('matchPlaces', () => {
  it('recognises the same spot when the visit starts facing another way', () => {
    // Starting at the saved 90° facing: the saved 90° reading is now "ahead", and the saved 180° one is to the right.
    const visit = toPlaceReadings([
      { headingDeg: 90, distanceM: 1.5 },
      { headingDeg: 180, distanceM: 4 },
    ]);
    const match = matchPlaces([kitchen()], visit);
    expect(match?.place.id).toBe('p1');
    expect(match?.ambiguousWith).toBeNull();
    expect(match?.rotationDeg).toBeCloseTo(90, 5);
    expect(placeHeading(match?.rotationDeg ?? 0, 0)).toBeCloseTo(90, 5);
  });

  it('matches when most of the fresh readings are explained', () => {
    const visit = toPlaceReadings([
      { headingDeg: 0, distanceM: 2 },
      { headingDeg: 90, distanceM: 1.5 },
      { headingDeg: 180, distanceM: 9 },
    ]);
    expect(matchPlaces([kitchen()], visit)?.place.id).toBe('p1');
  });

  it('does not match a room of another shape', () => {
    const visit = toPlaceReadings([
      { headingDeg: 0, distanceM: 1 },
      { headingDeg: 90, distanceM: 1 },
    ]);
    expect(matchPlaces([kitchen()], visit)).toBeNull();
  });

  it('needs two facings before it will name anything', () => {
    expect(matchPlaces([kitchen()], toPlaceReadings([{ headingDeg: 0, distanceM: 2 }]))).toBeNull();
  });

  it('refuses to choose between two places that sound alike', () => {
    const twin: Place = { ...kitchen(), id: 'p2', label: 'Place two' };
    const visit = toPlaceReadings([
      { headingDeg: 0, distanceM: 2 },
      { headingDeg: 90, distanceM: 1.5 },
    ]);
    const match = matchPlaces([kitchen(), twin], visit);
    expect(match?.ambiguousWith).not.toBeNull();
    expect(match?.ambiguousWith?.id).not.toBe(match?.place.id);
  });

  it('returns nothing when no place is saved', () => {
    expect(matchPlaces([], toPlaceReadings([{ headingDeg: 0, distanceM: 2 }]))).toBeNull();
  });
});

describe('marks', () => {
  it('adds a mark with its facing and the distance measured at the time', () => {
    const { place, duplicate } = addMark(kitchen(), 'doorway', 90, 1.5);
    expect(duplicate).toBe(false);
    expect(place.marks).toEqual([{ kind: 'doorway', headingDeg: 90, distanceM: 1.5 }]);
    // The original is untouched, so a failed save cannot half-apply.
    expect(kitchen().marks).toEqual([]);
  });

  it('does not mark the same thing twice', () => {
    const first = addMark(kitchen(), 'wall', 10, 2).place;
    const again = addMark(first, 'wall', 15, 2.3);
    expect(again.duplicate).toBe(true);
    expect(again.place.marks).toHaveLength(1);
  });

  it('allows a different kind at the same facing', () => {
    const first = addMark(kitchen(), 'wall', 90, 1.5).place;
    const second = addMark(first, 'obstacle', 90, 1.5);
    expect(second.duplicate).toBe(false);
    expect(second.place.marks).toHaveLength(2);
  });

  it('keeps at most the configured number of marks, dropping the oldest', () => {
    let place = kitchen();
    // Far enough apart in facing and distance that every one is a new mark.
    for (let i = 0; i < PLACES.maxMarksPerPlace + 2; i++) {
      place = addMark(place, 'obstacle', i * 30, 1 + i * 1.5).place;
    }
    expect(place.marks).toHaveLength(PLACES.maxMarksPerPlace);
    expect(place.marks.at(-1)?.headingDeg).toBeCloseTo((PLACES.maxMarksPerPlace + 1) * 30 - 360, 5);
  });

  it('speaks only the marks that face this way, nearest first', () => {
    const place = kitchen([
      { kind: 'wall', headingDeg: 5, distanceM: 2.5 },
      { kind: 'step', headingDeg: 355, distanceM: 1 },
      { kind: 'obstacle', headingDeg: 180, distanceM: 0.8 },
    ]);
    const here = marksAt(place, 0);
    expect(here.map((m) => m.kind)).toEqual(['step', 'wall']);
    expect(marksAt(place, 0, 1).map((m) => m.kind)).toEqual(['step']);
    expect(marksAt(place, 90)).toEqual([]);
  });

  it('calls out a mark whose distance has changed, and leaves small changes alone', () => {
    const place = kitchen([{ kind: 'doorway', headingDeg: 90, distanceM: 1 }]);
    expect(contradicted(place, 90, 1.2)).toBeNull();
    expect(contradicted(place, 90, 2.4)?.kind).toBe('doorway');
    // A different facing is not this mark.
    expect(contradicted(place, 0, 2.4)).toBeNull();
  });
});

describe('placeLabel', () => {
  it('names places as words while they last', () => {
    expect(placeLabel(0)).toBe('Place one');
    expect(placeLabel(PLACES.maxPlaces - 1)).toBe('Place eight');
  });
});
