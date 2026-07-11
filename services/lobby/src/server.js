import { createLobbyApp } from "./app.js";
import { initializeDatabase } from "./db.js";

const port = Number(process.env.PORT || 3002);

await initializeDatabase();
const app = createLobbyApp();
app.listen(port, () => console.log(`Lobby service listening on http://localhost:${port}`));
