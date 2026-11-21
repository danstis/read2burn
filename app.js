/**
 * Module dependencies.
 */
const { Umzug, JSONStorage } = require("umzug");
const express = require("express"),
  routes = require("./routes"),
  http = require("node:http"),
  path = require("node:path"),
  cron = require("node-cron"),
  Datastore = require("@seald-io/nedb"),
  { cleanupExpired } = require("./lib/cleanup"),
  version = require("./version");

const app = express();

const i18n = require("i18n");

// default: using 'accept-language' header to guess language settings
app.use(i18n.init);
app.set("cleanupcron", process.env.CLEANUP_CRON || "12 0 * * *"); // Default to 00:12 every day
app.set("expirytime", process.env.EXPIRY || 7776000000); // Default to 90 days
app.set("port", process.env.PORT || 3300);
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.Router());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.enable("trust proxy");
app.disable("x-powered-by");

const nedb = new Datastore({ filename: process.env.READ2BURN_DB_FILE || "data/read2burn.db", autoload: true });
const umzug = new Umzug({
  storage: new JSONStorage({ path: 'data/migrations.json' }),
  context: nedb,
  migrations: { glob: path.join(__dirname, 'migrations/*.js').split(path.sep).join('/') },
});

module.exports.nedb = nedb;

i18n.configure({
  locales: ["en", "de"],
  directory: __dirname + "/locales",
  defaultLocale: "en",
});

app.get("/", routes.index);
app.post("/", routes.index);

// never leak stack traces (e.g. body-parser 413/400) to clients
const ERROR_MESSAGES = { 413: "Argument too large.", 500: "Unexpected server error." };
app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).send(ERROR_MESSAGES[status] || "Bad request.");
});

// migrations must finish before we accept requests; a failure must be loud, never a silent half-upgrade
umzug
  .up()
  .then(function () {
    http.createServer(app).listen(app.get("port"), function () {
      console.log("Express server listening on port " + app.get("port"));
    });

    // schedule regular cleanup (only once migrations are done)
    const schedule = String(app.get("cleanupcron"));
    cron.schedule(schedule, function () {
      console.log("Cleanup proceeding...");
      cleanupExpired(nedb, app.get("expirytime"), function (err, numDeleted) {
        if (err) {
          console.error("Cleanup failed:", err);
          return;
        }
        console.log("Deleted", numDeleted, "entries");
        nedb.persistence.compactDatafile();
      });
    });
  })
  .catch(function (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  });

console.log("Version: " + version);
