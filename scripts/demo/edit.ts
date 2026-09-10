import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { validateEdit, type Manifest, type Edit } from "./evidence";

const arg = (name: string) => process.argv.find(s => s.startsWith(`--${name}=`))?.slice(name.length + 3);
async function command(name: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(name, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.resume();
    child.on("error", () => reject(new Error(`${name} is unavailable.`)));
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(`${name} failed; check input media and timing.`)));
  });
}
async function duration(file: string) {
  return Number((await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).trim());
}
async function main() {
  const manifestArg = arg("manifest");
  if (!manifestArg) throw new Error("Supply --manifest=runtime/recordings/RUN-.../take/manifest.json");
  const directory = path.dirname(path.resolve(manifestArg));
  const manifest: Manifest = JSON.parse(await readFile(manifestArg, "utf8"));
  let interventions = "";
  try { interventions = await readFile(path.join(directory, "operator-interventions.jsonl"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const operatorAssisted = interventions.trim().length > 0;
  const edit: Edit = JSON.parse(await readFile(arg("edit") ?? path.join(directory, "edit.json"), "utf8"));
  const source = path.resolve(directory, manifest.video);
  const seconds = await duration(source);
  validateEdit(manifest, edit, seconds);
  const out = path.join(directory, `export-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(path.join(out, "clips"), { recursive: true });
  const temp = await mkdtemp(path.join(tmpdir(), "yamnaya-edit-"));
  const clipNames: string[] = [];
  try {
    for (let i = 0; i < edit.segments.length; i++) {
      const s = edit.segments[i];
      const track = manifest.tracks?.[s.track ?? "dashboard"];
      const media = s.source ? path.resolve(directory, s.source) : track ? path.resolve(directory, track.video) : source;
      const mediaStart = s.start - (s.source ? 0 : track?.startedOffset ?? 0);
      if (mediaStart < 0 || mediaStart + s.end - s.start > await duration(media) + 0.04) throw new Error("Clip extends beyond its recording track.");
      if (s.source && s.end > await duration(media) + 0.04) throw new Error("External clip extends beyond supplied footage.");
      const speed = (s.end - s.start) / s.seconds;
      const label = `${edit.preview ? "CAPTURE PREVIEW" : "LIVE AGENTS - EDITED FOR TIME"}${operatorAssisted ? " - OPERATOR ASSISTED" : ""} | ${manifest.mode?.toUpperCase()} | SYNTHETIC UTILITY | ${edit.runId}`;
      const caption = `${s.title}${speed > 1.05 ? ` | ${speed.toFixed(1)}x speed` : speed < 0.95 ? " | Slowed for readability" : ""}`;
      const labelFile = path.join(temp, `label-${i}.txt`), titleFile = path.join(temp, `title-${i}.txt`);
      await writeFile(labelFile, label); await writeFile(titleFile, caption);
      const name = `${String(i + 1).padStart(2, "0")}.mp4`;
      const file = path.join(out, "clips", name);
      const filter = `setpts=(PTS-STARTPTS)/${speed},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,drawbox=x=0:y=0:w=iw:h=35:color=black@0.85:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${labelFile}:fontsize=17:fontcolor=white:x=30:y=8,drawbox=x=0:y=1024:w=iw:h=56:color=black@0.85:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${titleFile}:fontsize=24:fontcolor=white:x=30:y=1040,tpad=stop_mode=clone:stop_duration=0.05`;
      await command("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(mediaStart), "-t", String(s.end - s.start), "-i", media, "-vf", filter, "-t", String(s.seconds), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
      clipNames.push(name);
      console.log(`Rendered clip ${i + 1}/${edit.segments.length}: ${s.title}`);
    }
    await writeFile(path.join(out, "clips", "concat.txt"), clipNames.map(name => `file '${name}'`).join("\n"));
    const output = path.join(out, edit.preview ? "preview.mp4" : "yamnaya-60s.mp4");
    await command("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "1", "-i", path.join(out, "clips", "concat.txt"), "-c", "copy", "-movflags", "+faststart", output]);
    const actual = await duration(output);
    const expected = edit.segments.reduce((n, s) => n + s.seconds, 0);
    if (Math.abs(actual - expected) > 0.08) throw new Error("Export duration check failed.");
    const probe = JSON.parse(await command("ffprobe", ["-v", "error", "-show_streams", "-of", "json", output]));
    const stream = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
    if (!stream || stream.width !== 1920 || stream.height !== 1080 || stream.codec_name !== "h264" || stream.pix_fmt !== "yuv420p" || stream.r_frame_rate !== "30/1" || probe.streams.some((s: { codec_type: string }) => s.codec_type === "audio")) throw new Error("Export media-format verification failed.");
    await writeFile(path.join(out, "edit-used.json"), JSON.stringify(edit, null, 2));
    if (operatorAssisted) await writeFile(path.join(out, "operator-interventions.jsonl"), interventions);
    await writeFile(path.join(out, "narration.md"), edit.preview ? "# Camera preview\n\nThis is a capture/export check. It does not establish live agentic recovery.\n" : "# Narration outline\n\nUse only claims visible in this take.\n\n" + edit.segments.map((s, i) => `${i + 1}. ${s.title} (${s.seconds}s)`).join("\n") + "\n\nThe utility is synthetic. Field confirmations are digital acknowledgements by operations. This live run is edited for time. Close on independently verified mission recovery and observed continuity, not model narration alone.\n");
    if (operatorAssisted) await writeFile(path.join(out, "operator-note.md"), "This take includes operator intervention. The video is labeled OPERATOR ASSISTED; see operator-interventions.jsonl. Do not describe it as an unassisted recovery.\n");
    await writeFile(path.join(out, "verification.json"), JSON.stringify({ duration: actual, expected, width: stream.width, height: stream.height, codec: stream.codec_name, frameRate: stream.r_frame_rate, pixelFormat: stream.pix_fmt, narration: "silent", preview: edit.preview, operatorAssisted }, null, 2));
    console.log(`SAVED ${output} (${actual.toFixed(2)} seconds, ${edit.preview ? "labeled preview" : "live final"}).`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Export failed."); process.exitCode = 1; });
