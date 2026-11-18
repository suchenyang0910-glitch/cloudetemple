import { config } from "./security.mjs";
import { openStore } from "./store.mjs";
import { createServer } from "./app.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createFamilyApi } from "./family-api.mjs";
import { createPetApi } from "./pet-api.mjs";
import { openPetStore } from "./pet-store.mjs";
let settings;
try {
  settings = config(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const store = openStore(settings.db);
let familyCleanup, family;
if (settings.familyEnabled || settings.petEnabled) {
  family = openFamilyStore(store.db, { demo: false });
  family.cleanup();
  familyCleanup = setInterval(() => family.cleanup(), 60000);
  familyCleanup.unref();
}
const familyHandler = settings.familyEnabled ? createFamilyApi(settings, family) : async () => false;
const petHandler = settings.petEnabled ? createPetApi(settings, openPetStore(store.db), { family }) : async () => false;
const applicationHandler = async (req, res, route) => (await petHandler(req, res, route)) || familyHandler(req, res, route);
const server = createServer(settings, store, undefined, applicationHandler);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(settings.port, "127.0.0.1", () =>
  console.log("Chua May API ready"),
);
process.on("SIGTERM", () =>
  server.close(() => {
    if (familyCleanup) clearInterval(familyCleanup);
    store.close();
    process.exit(0);
  }),
);
