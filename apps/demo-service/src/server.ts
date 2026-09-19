import { startDemoServer } from './app.js';

startDemoServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
