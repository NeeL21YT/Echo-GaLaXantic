import { describe, expect, it } from 'vitest';
import { actionForVolumeKey, createVolumeKeyGuard } from '../src/input/volumeKeys';

describe('actionForVolumeKey', () => {
  it('up clicks while practising', () => {
    expect(actionForVolumeKey('up', ['click', 'left', 'right'], 'ready')).toBe('click');
  });
  it('down replays the last sound while practising', () => {
    expect(actionForVolumeKey('down', ['click', 'left', 'right'], 'ready')).toBe('replay');
  });
  it('up and down both go to Next in feedback', () => {
    const fb = ['replay', 'contrast', 'next'] as const;
    expect(actionForVolumeKey('up', fb, 'feedback')).toBe('next');
    expect(actionForVolumeKey('down', fb, 'feedback')).toBe('next');
  });
  it('begins from the intro and from a lesson', () => {
    expect(actionForVolumeKey('up', ['answer'], 'lesson')).toBe('answer');
    expect(actionForVolumeKey('up', ['next', 'replay'], 'lesson')).toBe('next');
  });
  it('does nothing when nothing fits', () => {
    expect(actionForVolumeKey('down', ['help'], 'lesson')).toBeNull();
  });
});

describe('real room guessing', () => {
  it('up is far and down is near while guessing, and ping or replay otherwise', () => {
    const guessing = ['far', 'near', 'answer', 'click'] as const;
    expect(actionForVolumeKey('up', guessing, 'realRoom')).toBe('far');
    expect(actionForVolumeKey('down', guessing, 'realRoom')).toBe('near');
    expect(actionForVolumeKey('up', ['click', 'help'], 'realRoom')).toBe('click');
    expect(actionForVolumeKey('down', ['replay', 'next', 'click'], 'realRoom')).toBe('replay');
  });
  it('does not turn level two near and far answers into volume answers', () => {
    expect(actionForVolumeKey('up', ['click', 'near', 'far'], 'ready')).toBe('click');
  });
});

describe('volume key extras', () => {
  it('up accepts a speed offer before moving on', () => {
    expect(actionForVolumeKey('up', ['acceptStretch', 'next'], 'lesson')).toBe('acceptStretch');
  });

  it('ignores a held key but not a second press later or the other key', () => {
    let t = 0;
    const allowed = createVolumeKeyGuard(150, () => t);
    expect(allowed('up')).toBe(true);
    t = 50;
    expect(allowed('up')).toBe(false);
    expect(allowed('down')).toBe(true);
    t = 400;
    expect(allowed('up')).toBe(true);
  });
});
