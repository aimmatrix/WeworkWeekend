import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Second vision provider: Grok reached through the Cursor agent CLI. Used when there is
// no XAI_API_KEY but a CURSOR_API_KEY is set and the `cursor-agent` binary is installed.
const BIN = process.env.CURSOR_AGENT_BIN || "cursor-agent";
export const AGENT_VISION_MODEL = process.env.CURSOR_VISION_MODEL || "cursor-grok-4.5-high-fast";
export const agentVisionEnabled = () => Boolean(process.env.CURSOR_API_KEY);

const run = promisify(execFile);

async function bytes(src: string, origin: string): Promise<Buffer> {
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const res = await fetch(new URL(src, origin), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * One vision call that must answer with a single JSON object.
 * The photos are written to an empty temp folder and the agent runs there in read-only "ask" mode,
 * so it can look at the photos and nothing else.
 */
export async function agentVisionJSON<T>(opts: { system: string; prompt: string; images: string[]; origin: string }): Promise<{ data: T; model: string }> {
  const dir = await mkdtemp(join(tmpdir(), "scan-"));
  try {
    const names = await Promise.all(
      opts.images.map(async (src, i) => {
        const name = `photo${i}.jpg`;
        await writeFile(join(dir, name), await bytes(src, opts.origin));
        return name;
      }),
    );
    const prompt = [
      opts.system,
      "",
      opts.prompt,
      `The photos are the image files ${names.join(", ")} in this folder; photoN.jpg is photo number N. Open and look at every one.`,
      "Reply with ONLY one JSON object and no other text.",
    ].join("\n");

    const { stdout } = await run(BIN, ["-p", "--mode", "ask", "--trust", "--model", AGENT_VISION_MODEL, "--output-format", "json", prompt], {
      cwd: dir,
      timeout: 150_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const reply: string = JSON.parse(stdout.slice(stdout.indexOf("{"))).result ?? "";
    const start = reply.indexOf("{");
    const end = reply.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("The model did not return JSON");
    return { data: JSON.parse(reply.slice(start, end + 1)) as T, model: AGENT_VISION_MODEL };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
