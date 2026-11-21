// Places (real-room check): a standing spot remembered by its echo signature, plus what the learner marked there.
// Pure: no DOM, audio or store imports.
//
// There is no indoor position sensor: GPS dies indoors and step counting drifts within a few steps and cannot say a
// place has been reached again. So a place is recognised by what it *sounds* like from one spot — the distance to the
// nearest surface in each facing — and never by coordinates. Two saved places that sound alike are not told apart;
// the learner is told they are alike instead of being handed a guess.
import { PLACES } from '../config';
import { normaliseHeading, type DirectedRange } from './roomDirection';

export type MarkKind = 'wall' | 'doorway' | 'step' | 'obstacle';

export const MARK_KINDS: readonly MarkKind[] = ['wall', 'doorway', 'step', 'obstacle'];

export const isMarkKind = (v: unknown): v is MarkKind => MARK_KINDS.includes(v as MarkKind);

/** A distance measured while the phone faced `headingDeg`, both relative to the place's own first facing. */
export type PlaceReading = { headingDeg: number; distanceM: number };

/** What the learner says is there: a kind, the facing, and the distance that was measured at the time. */
export type PlaceMark = { kind: MarkKind; headingDeg: number; distanceM: number };

export type Place = { id: string; label: string; readings: PlaceReading[]; marks: PlaceMark[] };

const PLACE_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

/** "Place one" … "Place eight"; past the end it speaks a number rather than nothing. */
export function placeLabel(index: number): string {
  return `Place ${PLACE_WORDS[index] ?? index + 1}`;
}

/** The visit's readings with headings made relative to the first of them, so any rotation can be compared. */
export function toPlaceReadings(readings: readonly DirectedRange[]): PlaceReading[] {
  const first = readings[0]?.headingDeg;
  if (first === undefined) return [];
  return readings.slice(0, PLACES.maxReadingsPerPlace).map((r) => ({
    headingDeg: normaliseHeading(r.headingDeg - first),
    distanceM: r.distanceM,
  }));
}

/** The short way round between two headings, 0–180. */
function headingGap(a: number, b: number): number {
  const gap = Math.abs(normaliseHeading(a - b));
  return gap > 180 ? 360 - gap : gap;
}

/** A heading in the place's own frame, given a heading relative to the visit and the rotation that matched them. */
export function placeHeading(rotationDeg: number, visitHeadingDeg: number): number {
  return normaliseHeading(visitHeadingDeg + rotationDeg);
}

export type PlaceMatch = {
  place: Place;
  /** Added to a visit-relative heading to get the place's own heading. */
  rotationDeg: number;
  matched: number;
  score: number;
  /** Another saved place that fits almost as well, so neither may be named. */
  ambiguousWith: Place | null;
};

function scorePlace(place: Place, current: readonly PlaceReading[]): PlaceMatch | null {
  let best: { rotationDeg: number; matched: number; score: number } | null = null;
  // The visit may start facing any way, so try every alignment of one fresh reading onto one saved reading.
  for (const c of current) {
    for (const p of place.readings) {
      const rotationDeg = normaliseHeading(p.headingDeg - c.headingDeg);
      let matched = 0;
      for (const reading of current) {
        const heading = normaliseHeading(reading.headingDeg + rotationDeg);
        const saved = place.readings.find((r) => headingGap(r.headingDeg, heading) <= PLACES.sameHeadingDeg);
        if (saved && Math.abs(saved.distanceM - reading.distanceM) <= PLACES.sameDistanceM) matched += 1;
      }
      const score = matched / current.length;
      if (!best || score > best.score) best = { rotationDeg, matched, score };
    }
  }
  if (!best || best.matched < 2 || best.score < PLACES.matchShare) return null;
  return { place, ...best, ambiguousWith: null };
}

/** The saved place that best explains the fresh readings, or null when none explains enough of them. */
export function matchPlaces(places: readonly Place[], current: readonly PlaceReading[]): PlaceMatch | null {
  if (current.length < 2) return null;
  const scored: PlaceMatch[] = [];
  for (const place of places) {
    const match = scorePlace(place, current);
    if (match) scored.push(match);
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  const next = scored[1];
  return { ...best, ambiguousWith: next && best.score - next.score <= PLACES.tieShare ? next.place : null };
}

/** Adds a mark, or reports that this thing is already marked at this facing and distance. Returns a new place. */
export function addMark(
  place: Place,
  kind: MarkKind,
  headingDeg: number,
  distanceM: number,
): { place: Place; duplicate: boolean } {
  const heading = normaliseHeading(headingDeg);
  const same = place.marks.some(
    (m) =>
      m.kind === kind &&
      headingGap(m.headingDeg, heading) <= PLACES.markHeadingDeg &&
      Math.abs(m.distanceM - distanceM) <= PLACES.sameDistanceM,
  );
  if (same) return { place, duplicate: true };
  const marks = [...place.marks, { kind, headingDeg: heading, distanceM }].slice(-PLACES.maxMarksPerPlace);
  return { place: { ...place, marks }, duplicate: false };
}

/** The marks that face this way, nearest first, at most `limit`. */
export function marksAt(place: Place, headingDeg: number, limit: number = PLACES.marksSpoken): PlaceMark[] {
  const heading = normaliseHeading(headingDeg);
  return place.marks
    .filter((m) => headingGap(m.headingDeg, heading) <= PLACES.markHeadingDeg)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** A mark at this facing whose distance the fresh measurement now contradicts, or null when they agree. */
export function contradicted(place: Place, headingDeg: number, measuredM: number): PlaceMark | null {
  const heading = normaliseHeading(headingDeg);
  let worst: PlaceMark | null = null;
  for (const m of place.marks) {
    if (headingGap(m.headingDeg, heading) > PLACES.markHeadingDeg) continue;
    const gap = Math.abs(m.distanceM - measuredM);
    if (gap <= PLACES.contradictionM) continue;
    if (!worst || gap > Math.abs(worst.distanceM - measuredM)) worst = m;
  }
  return worst;
}
