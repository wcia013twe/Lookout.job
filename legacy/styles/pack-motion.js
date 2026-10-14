// Presentation keyframes, kept out of the pack state controller.
export const tearTop = {
  transform: ['translate(0, 0) rotate(0deg)', 'translate(-35px, -140px) rotate(-12deg)'],
  opacity: [1, 0],
};
export const tearBottom = {
  transform: ['translate(0, 0) rotate(0deg)', 'translate(35px, 140px) rotate(12deg)'],
  opacity: [1, 0],
};
export const tearTiming = { duration: .6, ease: [.16, 1, .3, 1] };
