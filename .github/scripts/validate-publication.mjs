import { execFileSync } from "node:child_process";
import fs from "node:fs";

const [repository, sha, baseRepository] = process.argv.slice(2);
if (repository === undefined || repository === "") throw new Error("candidate repository is required");
if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) throw new Error("candidate SHA is invalid");
if (baseRepository === undefined || baseRepository === "") throw new Error("base repository is required");

const gitAt = (path, ...args) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim();
const git = (...args) => gitAt(repository, ...args);
const parents = git("show", "--no-patch", "--format=%P", sha).split(/\s+/u).filter(Boolean);
if (parents.length !== 1) throw new Error("publication commits must have exactly one parent");
const baseSha = gitAt(baseRepository, "rev-parse", "HEAD");
if (parents[0] !== baseSha) throw new Error("publication commit must be a direct child of current main");

const changedPaths = git(
  "diff-tree",
  "--no-commit-id",
  "--name-only",
  "-r",
  parents[0],
  sha,
).split("\n").filter(Boolean);
if (changedPaths.length === 0) throw new Error("publication commit changes no files");
if (changedPaths.length > 3) throw new Error("publication commit changes more than three files");

const allowed = /^(lax-[1-9][0-9]*)\/(record\.json|build-output\.json|owner-list\.json)$/u;
const folders = new Set();
const filenames = new Set();
for (const changedPath of changedPaths) {
  const match = allowed.exec(changedPath);
  if (match === null) throw new Error(`publication changes forbidden path: ${changedPath}`);
  folders.add(match[1]);
  if (filenames.has(match[2])) throw new Error(`publication changes duplicate file: ${match[2]}`);
  filenames.add(match[2]);
}
if (folders.size !== 1) throw new Error("publication commit must change exactly one Archive folder");
const folder = [...folders][0];
const expectedPaths = new Set([
  `${folder}/record.json`,
  `${folder}/build-output.json`,
  `${folder}/owner-list.json`,
]);
const finalEntries = git("ls-tree", "-r", "--full-tree", sha, "--", folder).split("\n").filter(Boolean);
if (finalEntries.length !== expectedPaths.size) {
  throw new Error("publication folder must contain exactly the three canonical Archive files");
}
for (const entry of finalEntries) {
  const match = /^100644 blob [0-9a-f]+\t(.+)$/u.exec(entry);
  if (match === null || !expectedPaths.delete(match[1])) {
    throw new Error("publication folder contains a non-canonical or non-regular file");
  }
}
if (expectedPaths.size !== 0) throw new Error("publication folder is missing a canonical Archive file");

const summary = [
  "### lax-database publication guard",
  "",
  `Accepted folder: \`${folder}\``,
  "",
  ...changedPaths.map((changedPath) => `- \`${changedPath}\``),
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY !== undefined && process.env.GITHUB_STEP_SUMMARY !== "") {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}
console.log(summary);
