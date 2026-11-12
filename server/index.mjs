import { config } from "./security.mjs";
import { openStore } from "./store.mjs";
import { createServer } from "./app.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createFamilyApi } from "./family-api.mjs";
import { openMetricsStore } from "./metrics-store.mjs";
import { createMetricsApi } from "./metrics-api.mjs";
import { createAccessVerifier } from "./access-auth.mjs";
import { createPetModerationModule } from "./pet-admin-api.mjs";
import { hash } from "./security.mjs";
let settings;
try {
  settings = config(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const store = openStore(settings.db);
const metrics = openMetricsStore(store.db);
metrics.cleanup();
let presenceSample;
if (settings.presenceEnabled) {
  presenceSample = setInterval(() => metrics.samplePresence(), 30000);
  presenceSample.unref();
}
let familyCleanup, familyStore;
const familyHandler =
  settings.familyEnabled
    ? (() => {
        familyStore = openFamilyStore(store.db, { demo: false });
        familyStore.cleanup();
        familyCleanup = setInterval(() => familyStore.cleanup(), 60000);
        familyCleanup.unref();
        return createFamilyApi(settings, familyStore, { metric: (name, dimension) => metrics.count(name, dimension) });
      })()
    : async () => false;
const access = settings.adminEnabled ? createAccessVerifier(settings) : { validate: async () => { throw Error("disabled"); } };
const verifyBound = (req) => {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((part) => part.startsWith("ct_session="))?.slice(11);
  return raw && familyStore?.sessionUser(hash(settings.hashSecret, raw))?.user_id;
};
const { pet, handleAdmin: petAdminHandler, handlePublic: petHandler } = settings.petEnabled
  ? createPetModerationModule(settings, store.db, {
      access,
      adminOrigin: "https://adminchy-staging.chuamay.org",
      verifyBound,
    })
  : { handleAdmin: async () => false, handlePublic: async () => false };
let petMaintenance;
const dayMs = 86400000;
function schedulePetMaintenance() {
  const bangkokOffset = 7 * 3600000;
  const delay = dayMs - ((Date.now() + bangkokOffset) % dayMs);
  petMaintenance = setTimeout(() => {
    const now = Date.now();
    try {
      const {movedToWall, clearedRates} = pet.maintain(now, now - 365 * dayMs);
      console.log(`Pet maintenance movedToWall=${movedToWall} clearedRates=${clearedRates}`);
    } catch {
      console.error("Pet maintenance failed");
    }
    schedulePetMaintenance();
  }, delay);
  petMaintenance.unref();
}
if (settings.petMaintenanceEnabled) schedulePetMaintenance();
const metricsHandler = createMetricsApi(settings, metrics, access, familyStore);
const applicationHandler = async (req, res, route) => {
  const petRoute = route === "/pet-garden" || route.startsWith("/pet-garden/") ? `/api${route}` : route;
  if (settings.environment === "staging" && petRoute !== route && /^Basic /i.test(req.headers.authorization || "")) {
    delete req.headers.authorization;
  }
  return (await petAdminHandler(req, res, route)) || (await petHandler(req, res, petRoute)) || (await metricsHandler(req, res, route)) || familyHandler(req, res, route);
};
const server = createServer(settings, store, undefined, applicationHandler, (status) => { if (status >= 500) metrics.error(); });
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(settings.port, "127.0.0.1", () =>
  console.log("Chua May API ready"),
);
process.on("SIGTERM", () =>
  server.close(() => {
    if (familyCleanup) clearInterval(familyCleanup);
    if (presenceSample) clearInterval(presenceSample);
    if (petMaintenance) clearTimeout(petMaintenance);
    store.close();
    process.exit(0);
  }),
);
