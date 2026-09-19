import { startApiServer } from './app.js';

startApiServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
