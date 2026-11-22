// The real-room check needs a phone's speaker, microphone and heading sensor, so a desktop browser does not offer it.
// A phone, a tablet and the Android app's web view all report a coarse primary pointer; a mouse or trackpad does not.
export function realRoomAvailable(): boolean {
  // Without a window or matchMedia we cannot tell, so nothing is hidden.
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}
