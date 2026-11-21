// aria-live region for screen-reader mode (§9.4). The screen reader speaks whatever lands here.
import { useEcho } from '../state/store';

export function Announcer() {
  const narration = useEcho((s) => s.settings.narration);
  const announcement = useEcho((s) => s.announcement);

  // Voice mode keeps this region silent except for errors, so speech is never doubled.
  const text = narration === 'screenreader' || announcement.isError ? announcement.text : '';

  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {/* Keyed by id so an identical repeated message is still announced. */}
      <p key={announcement.id}>{text}</p>
    </div>
  );
}
