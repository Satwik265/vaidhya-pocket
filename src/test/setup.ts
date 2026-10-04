import '@testing-library/jest-dom';

// Mock window.speechSynthesis for jsdom
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speak: () => {},
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      getVoices: () => [],
    },
    writable: true,
  });

  // Mock navigator.clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: () => Promise.resolve(),
    },
    writable: true,
  });

  // Mock Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = () => {};

  // Mock Element.prototype.animate for motion / happy-dom
  Element.prototype.animate = () => ({
    finished: Promise.resolve(),
    cancel: () => {},
    play: () => {},
    pause: () => {},
    reverse: () => {},
    finish: () => {},
    currentTime: 0,
    playbackRate: 1,
    playState: 'finished',
    addEventListener: () => {},
    removeEventListener: () => {},
  } as any);
}
