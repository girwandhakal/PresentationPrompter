/// <reference types="next/image-types/global" />

// Lets `import shot from "./shot.webp"` type-check without depending on next-env.d.ts, which Next
// generates on build and dev and which is not committed, so a fresh checkout (CI) would not have it.
