import { startStandaloneServer } from "./src/presentation/http/StandaloneServer.js";

export { startStandaloneServer };

await startStandaloneServer(process.argv.slice(2));
