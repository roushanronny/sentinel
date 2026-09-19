import { startGatewayServer } from './app.js';

startGatewayServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
