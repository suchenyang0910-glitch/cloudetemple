import { config } from "./security.mjs";
import { openStore } from "./store.mjs";
import { createServer } from "./app.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createFamilyApi } from "./family-api.mjs";
import { openMetricsStore } from "./metrics-store.mjs";
import { createMetricsApi } from "./metrics-api.mjs";
import { createAccessVerifier } from "./access-auth.mjs";
import { openPetStore } from "./pet-store.mjs";
import { createPetApi } from "./pet-api.mjs";
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
const pet = openPetStore(store.db);
const petHandler = createPetApi(settings, pet, {
  verifyAdmin: (req) => settings.adminEnabled
    ? access.validate(req.headers["cf-access-jwt-assertion"]).then(() => true, () => false)
    : false,
});
const metricsHandler = createMetricsApi(settings, metrics, access, familyStore);
const applicationHandler = async (req, res, route) => {
  const petRoute = route === "/pet-garden" || route.startsWith("/pet-garden/") ? `/api${route}` : route;
  if (settings.environment === "staging" && petRoute !== route && /^Basic /i.test(req.headers.authorization || "")) {
    delete req.headers.authorization;
  }
  return (await petHandler(req, res, petRoute)) || (await metricsHandler(req, res, route)) || familyHandler(req, res, route);
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
    store.close();
    process.exit(0);
  }),
);
