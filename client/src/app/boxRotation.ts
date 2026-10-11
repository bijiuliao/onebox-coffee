// Shared with BoxStatsHero (which drives rotation via the ring's dot) and
// RotatingBox3D (which just points the box wherever it's told). Kept in
// their own tiny side-effect-free module rather than exported from
// RotatingBox3D.tsx itself, so importing these two numbers doesn't drag
// Three.js into whichever chunk reads them - RotatingBox3D is lazy-loaded
// specifically to keep that out of the main bundle.

// The model's labeled face already faces the camera at rotation 0 (its own
// authored orientation, unrelated to the label's position within the
// texture) - no extra rest rotation needed.
export const REST_ROTATION = 0;
// Onyx's own hero box doesn't spin freely - the ring's dot only swings a
// limited amount each way before stopping, so you're peeking at the side
// panels rather than spinning all the way around to the blank back.
export const MAX_SWING = Math.PI / 3;
