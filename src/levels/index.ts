import type { LevelDef } from './types';
import { level1 } from './level1Side';
import { level2 } from './level2Distance';
import { level3 } from './level3Door';
import { level4 } from './level4Pole';
import { level5 } from './level5Escape';

export const LEVELS: readonly LevelDef[] = [level1, level2, level3, level4, level5];

export function getLevel(id: LevelDef['id']): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`unknown level ${id}`);
  return level;
}
