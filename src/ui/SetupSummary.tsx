// A glance for the sighted person setting the phone up: what is on, and what still needs doing.
// Read as plain text by a screen reader too, so nothing here is visual-only.
import { isNative } from '../native/echoNative';
import { useEcho } from '../state/store';

export function SetupSummary() {
  const settings = useEcho((s) => s.settings);
  const screenReaderOn = useEcho((s) => s.screenReaderOn);
  const micOn = useEcho((s) => s.micOn);
  const native = isNative();

  const morse = { off: 'Morse off', vibration: 'Morse: vibration', sound: 'Morse: beeps' }[settings.morse];
  return (
    <ul className="chips setup" aria-label="Setup">
      <li className={screenReaderOn ? 'chip on' : 'chip'}>
        {screenReaderOn ? 'Screen reader on: touch gestures off' : 'Screen reader off: touch gestures on'}
      </li>
      <li className={settings.narration === 'voice' ? 'chip on' : 'chip'}>
        {settings.narration === 'voice' ? 'Echo speaks' : 'Screen reader speaks'}
      </li>
      {native && (
        <li className={settings.volumeKeys && !screenReaderOn ? 'chip on' : 'chip'}>
          {settings.volumeKeys && !screenReaderOn ? 'Volume buttons control Echo' : 'Volume buttons: phone volume'}
        </li>
      )}
      <li className={micOn ? 'chip on' : 'chip'}>{micOn ? 'Mic on' : 'Mic off'}</li>
      <li className={settings.morse === 'off' ? 'chip' : 'chip on'}>{morse}</li>
      <li className={settings.haptics ? 'chip on' : 'chip'}>{settings.haptics ? 'Feel the answer on' : 'Feel the answer off'}</li>
    </ul>
  );
}
