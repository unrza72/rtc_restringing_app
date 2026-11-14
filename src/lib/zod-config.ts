import { z } from 'zod'

// Zod 4 compiles validators with `new Function` when it may, and finds out by
// trying. The CSP forbids that in the browser (no 'unsafe-eval'), so every page
// would report a violation; told up front, Zod validates without compiling.
// Imported first in src/router.tsx, ahead of any module that builds a schema.
if (typeof document !== 'undefined') z.config({ jitless: true })
