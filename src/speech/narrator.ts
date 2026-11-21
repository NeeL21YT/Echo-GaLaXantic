export function speak(_text: string): Promise<void> {
  throw new Error('not implemented: speak');
}

export function cancel(): void {
  throw new Error('not implemented: cancel');
}

export function awaitIdle(): Promise<void> {
  throw new Error('not implemented: awaitIdle');
}
