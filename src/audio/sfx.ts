const ni = (name: string): Promise<void> => Promise.reject(new Error(`not implemented: ${name}`));

export const bump = (): Promise<void> => ni('bump');
export const correct = (): Promise<void> => ni('correct');
export const wrong = (): Promise<void> => ni('wrong');
export const levelUp = (): Promise<void> => ni('levelUp');
export const lrTest = (_side: 'left' | 'right'): Promise<void> => ni('lrTest');
