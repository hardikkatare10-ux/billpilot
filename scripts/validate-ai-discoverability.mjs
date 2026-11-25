import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const urnPattern = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;

function readText(relativePath) {
  const fullPath = path.join(publicDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing public file: /${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function validateLlms(relativePath) {
  const text = readText(relativePath);
  if (!/^# [^\r\n]+\r?\n/.test(text)) {
    throw new Error(`/${relativePath} must begin with an H1 title`);
  }
  if (!text.includes("\n> ")) {
    throw new Error(`/${relativePath} should include a summary blockquote`);
  }
}

function validateCatalog(relativePath) {
  const text = readText(relativePath);
  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch (error) {
    throw new Error(`/${relativePath} contains invalid JSON: ${error.message}`);
  }

  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error(`/${relativePath} root must be a JSON object`);
  }
  if (!Array.isArray(catalog.entries)) {
    throw new Error(`/${relativePath} must contain an entries array`);
  }

  for (const [index, entry] of catalog.entries.entries()) {
    const label = `${relativePath} entry ${index}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} must be an object`);
    }
    for (const field of ["identifier", "displayName", "type"]) {
      if (typeof entry[field] !== "string" || !entry[field]) {
        throw new Error(`${label} requires string '${field}'`);
      }
    }
    if (!urnPattern.test(entry.identifier)) {
      throw new Error(`${label} identifier must match urn:air:<publisher>:<namespace>:<name>`);
    }
    if (!entry.url && !entry.data) {
      throw new Error(`${label} requires exactly one of url or data`);
    }
    if (entry.url && entry.data) {
      throw new Error(`${label} must not contain both url and data`);
    }
    if (entry.url && (typeof entry.url !== "string" || !/^https?:\/\//.test(entry.url))) {
      throw new Error(`${label} url must be an absolute HTTP(S) URL`);
    }
    if (entry.representativeQueries !== undefined) {
      if (!Array.isArray(entry.representativeQueries) ||
          entry.representativeQueries.some((query) => typeof query !== "string")) {
        throw new Error(`${label} representativeQueries must be an array of strings`);
      }
    }
  }
}

[
  "llms.txt",
  "dukan-yantra/llms.txt",
  "nearbasket/llms.txt",
].forEach(validateLlms);

[
  ".well-known/ard.json",
  "ai-catalog.json",
  "dukan-yantra/ai-catalog.json",
  "nearbasket/ai-catalog.json",
].forEach(validateCatalog);

console.log("AI discoverability files validated successfully.");
