import { execFileSync } from "node:child_process";
import fs from "node:fs";

const [repository, sha] = process.argv.slice(2);
if (repository === undefined || repository === "") throw new Error("candidate repository is required");
if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) throw new Error("candidate SHA is invalid");

const git = (...args) => execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
const parents = git("show", "--no-patch", "--format=%P", sha).split(/\s+/u).filter(Boolean);
if (parents.length !== 1) throw new Error("publication commits must have exactly one parent");

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

const summary = [
  "### lax-database publication guard",
  "",
  `Accepted folder: \`${[...folders][0]}\``,
  "",
  ...changedPaths.map((changedPath) => `- \`${changedPath}\``),
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY !== undefined && process.env.GITHUB_STEP_SUMMARY !== "") {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}
console.log(summary);
