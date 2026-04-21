import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.CODEMOD_LLM_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const API_KEY = process.env.CODEMOD_LLM_API_KEY;
const MODEL = process.env.CODEMOD_AI_MODEL ?? "gemini-2.5-flash-lite";

if (!API_KEY) {
  console.error("CODEMOD_LLM_API_KEY is required");
  process.exit(1);
}

const workflow = fs.readFileSync(path.resolve("workflow.yaml"), "utf8");
const promptMatch = workflow.match(/prompt: \|\n([\s\S]*?)(?=\n[a-z_-]+:|\n {0,12}$)/);
if (!promptMatch) {
  console.error("Could not extract AI prompt from workflow.yaml");
  process.exit(1);
}
const systemPrompt = promptMatch[1].replace(/^ {12}/gm, "").trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(body) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

async function refactor(filePath, src) {
  const userPrompt = `File: ${path.basename(filePath)}\n\nInput (wagmi v1 code after deterministic step):\n\`\`\`tsx\n${src}\n\`\`\`\n\nReturn ONLY the refactored file contents. No markdown fences, no commentary, no explanation. Start with the first line of code and end with the last line of code.`;
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 16000,
  };
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const json = await callOnce(body);
      let out = json.choices?.[0]?.message?.content ?? "";
      out = out.replace(/^```(?:tsx?|typescript|jsx?|javascript)?\n/, "").replace(/\n```\s*$/, "");
      return { out, usage: json.usage };
    } catch (e) {
      lastErr = e;
      if (e.status && e.status >= 500 && e.status < 600) {
        const wait = 2000 * Math.pow(2, attempt);
        console.log(`  retry ${attempt + 1}/5 after ${wait}ms (${e.status})`);
        await sleep(wait);
        continue;
      }
      if (e.status === 429) {
        const wait = 5000 * Math.pow(2, attempt);
        console.log(`  rate-limit retry ${attempt + 1}/5 after ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

const [, , ...argv] = process.argv;
if (argv.length < 2) {
  console.error("Usage: node run-ai-step.mjs <src-root> <dst-root> [file1 file2 ...]");
  process.exit(1);
}
const [srcRoot, dstRoot, ...explicitFiles] = argv;

async function run() {
  const files = explicitFiles.length
    ? explicitFiles
    : [];
  if (!files.length) {
    console.error("Pass explicit relative file paths (batch discovery not enabled here).");
    process.exit(1);
  }
  let totalPrompt = 0, totalCompletion = 0;
  const failed = [];
  for (const rel of files) {
    const srcPath = path.join(srcRoot, rel);
    const dstPath = path.join(dstRoot, rel);
    const src = fs.readFileSync(srcPath, "utf8");
    console.log(`→ ${rel} (${src.length} chars)`);
    try {
      const { out, usage } = await refactor(rel, src);
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.writeFileSync(dstPath, out, "utf8");
      totalPrompt += usage?.prompt_tokens ?? 0;
      totalCompletion += usage?.completion_tokens ?? 0;
      console.log(`  tokens: ${usage?.prompt_tokens}/${usage?.completion_tokens}`);
    } catch (e) {
      console.log(`  FAILED: ${e.message.slice(0, 200)}`);
      failed.push(rel);
    }
  }
  if (failed.length) console.log(`\nFailed: ${failed.join(", ")}`);
  console.log(`\nTotal: ${totalPrompt} prompt / ${totalCompletion} completion tokens across ${files.length} files.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
