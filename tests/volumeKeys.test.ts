import { describe, expect, it } from 'vitest';
import { actionForVolumeKey } from '../src/input/volumeKeys';

describe('actionForVolumeKey', () => {
  it('up clicks while practising', () => {
    expect(actionForVolumeKey('up', ['click', 'left', 'right'], true)).toBe('click');
  });
  it('down replays the last sound while practising', () => {
    expect(actionForVolumeKey('down', ['click', 'left', 'right'], true)).toBe('replay');
  });
  it('up and down both continue in feedback, but down replays first', () => {
    const fb = ['replay', 'contrast', 'next'] as const;
    expect(actionForVolumeKey('up', fb, false)).toBe('next');
    expect(actionForVolumeKey('down', fb, false)).toBe('replay');
  });
  it('begins from the intro and from a lesson', () => {
    expect(actionForVolumeKey('up', ['answer'], false)).toBe('answer');
    expect(actionForVolumeKey('up', ['next', 'replay'], false)).toBe('next');
  });
  it('does nothing when nothing fits', () => {
    expect(actionForVolumeKey('down', ['help'], false)).toBeNull();
  });
});
