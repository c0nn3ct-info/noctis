#!/usr/bin/env node
// Entry point for `npm run lint`: fail when a component or page has no story.
// The work lives in stories-check-core.mjs, which is importable on its own.
import { main } from './stories-check-core.mjs';

process.exit(main());
