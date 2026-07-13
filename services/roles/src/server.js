import { createRoleApp } from "./app.js";
import { initializeDatabase } from "./db.js";

const port = Number(process.env.PORT || 3003);

await initializeDatabase();
const app = createRoleApp();
app.listen(port, () => console.log(`Role service listening on http://localhost:${port}`));
