/**
 * Module dependencies.
 */
const { Umzug, JSONStorage } = require("umzug");
const express = require("express"),
  routes = require("./routes"),
  http = require("http"),
  path = require("path"),
  bodyParser = require("body-parser"),
  cron = require("node-cron"),
  Datastore = require("@seald-io/nedb"),
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
app.use(bodyParser.urlencoded({ extended: false }));
app.enable("trust proxy");
app.disable("x-powered-by");

const nedb = new Datastore({ filename: "data/read2burn.db", autoload: true });
const umzug = new Umzug({
  storage: new JSONStorage({ path: 'data/migrations.json' }),
  context: nedb,
  migrations: { glob: 'migrations/*.js' },
});

module.exports.nedb = nedb;

i18n.configure({
  locales: ["en", "de"],
  directory: __dirname + "/locales",
  defaultLocale: "en",
});

app.get("/", routes.index);
app.post("/", routes.index);

umzug.up().then(function () {
  // migrations will be an Array with the names of the
  // executed migrations.
});

// start server
http.createServer(app).listen(app.get("port"), function () {
  console.log("Express server listening on port " + app.get("port"));
});

console.log("Version: " + version);

// schedule regular cleanup
const schedule = String(app.get("cleanupcron"));
cron.schedule(schedule, function () {
  console.log("Cleanup proceeding...");
  const expireTime = new Date().getTime() - app.get("expirytime"); // Expire secrets after expirytime
  nedb.remove(
    { timestamp: { $lte: expireTime } },
    { multi: true },
    function (err, numDeleted) {
      console.log("Deleted", numDeleted, "entries");
      nedb.compactDatafile();
    }
  );
});
