"use client";
import { useState } from "react";
import type { Camp, Publication } from "@yamnaya/core";
async function prepareImage(file: File) {
  if (
    file.size > 20000000 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("Choose a PNG, JPEG or WebP image under 20 MB");
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
      if (data.length <= 600000)
        return { data, width: canvas.width, height: canvas.height };
      scale *= 0.8;
    }
    throw new Error("This image is too large to import");
  } finally {
    bitmap.close();
  }
}
export default function GoogleImages({
  camp,
  publication,
  act,
  post,
}: {
  camp: Camp;
  publication: Publication;
  act: (fn: () => Promise<unknown>) => void;
  post: (route: string, data: unknown) => Promise<unknown>;
}) {
  const [prompt, setPrompt] = useState(""),
    [caption, setCaption] = useState(""),
    [copied, setCopied] = useState("");
  const briefs = (camp.imageBriefs ?? []).filter(
    (b) => b.publicationId === publication.id,
  );
  return (
    <details className="camp-google-images">
      <summary>Google image studio</summary>
      <p className="camp-muted">
        Use your Google website allowance. Camps prepare briefs; you generate in
        Gemini or AI Studio and import the result. Google shows your remaining
        allowance. No API or automatic purchases.
      </p>
      <div className="camp-row">
        <a
          href="https://gemini.google.com/app"
          target="_blank"
          rel="noreferrer"
        >
          Open Gemini ↗
        </a>
        <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
          Open AI Studio ↗
        </a>
      </div>
      <label className="camp-field">
        Image brief
        <textarea
          aria-label="Image brief"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={6000}
        />
      </label>
      <label className="camp-field">
        Image caption
        <input
          aria-label="Image caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={300}
        />
      </label>
      <button
        disabled={prompt.trim().length < 10 || caption.trim().length < 3}
        onClick={() =>
          act(async () => {
            await post("images/request", {
              publicationId: publication.id,
              prompt,
              caption,
            });
            setPrompt("");
            setCaption("");
          })
        }
      >
        Prepare Google image brief
      </button>
      {briefs.map((b) => (
        <section className="camp-card" key={b.id}>
          <strong>{b.caption}</strong>
          <p className="camp-muted">
            {b.status === "awaiting_operator"
              ? "Awaiting your Google generation"
              : b.status === "imported"
                ? "Imported into Quarto"
                : "Cancelled"}
          </p>
          <p>{b.prompt}</p>
          {b.status === "awaiting_operator" && (
            <>
              <div className="camp-row">
                <button
                  onClick={() =>
                    act(async () => {
                      await navigator.clipboard.writeText(b.prompt);
                      setCopied(b.id);
                    })
                  }
                >
                  {copied === b.id ? "Copied" : "Copy image prompt"}
                </button>
                <button
                  onClick={() => act(() => post("images/cancel", { id: b.id }))}
                >
                  Cancel brief
                </button>
              </div>
              <label className="camp-field">
                Import generated image
                <input
                  aria-label={`Import image: ${b.caption}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      act(async () =>
                        post("images/import", {
                          id: b.id,
                          version: publication.version,
                          ...(await prepareImage(file)),
                        }),
                      );
                  }}
                />
              </label>
            </>
          )}
          {b.file && <code>{b.file}</code>}
        </section>
      ))}
    </details>
  );
}
