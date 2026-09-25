import { runWorkerLoop } from './index.js';

runWorkerLoop().catch((err) => {
  console.error(err);
  process.exit(1);
});
