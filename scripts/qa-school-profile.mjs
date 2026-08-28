import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist-school-server");
const failures = [];
function check(label, ok, detail = "") {
  if (!ok) failures.push({ label, detail });
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}
function slash(value) { return String(value || "/").replace(/\/+$/, "") + "/"; }

check("school.dist.exists", fs.existsSync(dist));
if (fs.existsSync(dist)) {
  const deployment = readJson(path.join(dist, "config", "deployment.json"));
  const sourceStandalone = readJson(path.join(root, "src", "config", "deployment.json"));
  const sourceSchool = readJson(path.join(root, "src", "config", "deployment.school-server.json"));
  const studioBaseUrl = slash(deployment.studioBaseUrl || deployment.appBaseUrls?.["ai-studio"]);
  const expectedGuard = `${studioBaseUrl}access/app-guard.js`;
  check("school.profile", deployment.profile === "school-server", deployment.profile);
  check("school.auth.server-session", deployment.authMode === "server-session", deployment.authMode);
  check("school.ai.school-gateway", deployment.aiTransport === "school-gateway", deployment.aiTransport);
  check("school.local-keys.disabled", deployment.features?.allowLocalProviderKeys === false);
  check("school.shared-access.source-sync", sourceStandalone.sharedAccessVersion === sourceSchool.sharedAccessVersion,
    `${sourceStandalone.sharedAccessVersion} / ${sourceSchool.sharedAccessVersion}`);
  check("school.shared-access.build-sync", deployment.sharedAccessVersion === sourceSchool.sharedAccessVersion,
    `${deployment.sharedAccessVersion} / ${sourceSchool.sharedAccessVersion}`);
  check("school.studio.same-origin-path", studioBaseUrl.startsWith("/"), studioBaseUrl);

  const textExt = new Set([".html", ".js", ".json", ".css", ".webmanifest"]);
  const textFiles = walk(dist).filter((file) => textExt.has(path.extname(file)));
  const stale = textFiles.filter((file) => fs.readFileSync(file, "utf8").includes("/AI-Studio-GHRAB/"));
  check("school.no-standalone-studio-path", stale.length === 0, stale.map((f) => path.relative(dist, f)).join(", "));
  for (const rel of ["index.html", path.join("manual", "index.html")]) {
    const raw = fs.readFileSync(path.join(dist, rel), "utf8");
    check(`school.guard.${rel}`, raw.includes(expectedGuard), expectedGuard);
  }
}

const result = {
  schema: "ghrab-school-profile-qa-v1",
  status: failures.length ? "failed" : "passed",
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
