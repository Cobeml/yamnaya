"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Camp, EvaluationExample } from "@yamnaya/core";
import type { BoardThread } from "../../lib/camp-boards";
type Fields = Record<string, string>;
type Spec = {
  name: string;
  label: string;
  options?: { value: string; label: string }[];
  long?: boolean;
  optional?: boolean;
};
function Entry({
  title,
  fields,
  submit,
  button = "Save",
}: {
  title: string;
  fields: Spec[];
  submit: (data: Fields) => void;
  button?: string;
}) {
  return (
    <details className="camp-card">
      <summary>{title}</summary>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          submit(
            Object.fromEntries(new FormData(event.currentTarget)) as Fields,
          );
        }}
      >
        {fields.map((f) => (
          <label className="camp-field" key={f.name}>
            {f.label}
            {f.options ? (
              <select name={f.name} required={!f.optional}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.long ? (
              <textarea name={f.name} required={!f.optional} maxLength={6000} />
            ) : (
              <input name={f.name} required={!f.optional} maxLength={2000} />
            )}
          </label>
        ))}
        <button>{button}</button>
      </form>
    </details>
  );
}
const options = (items: { id: string; title?: string; name?: string }[]) =>
  items.map((x) => ({ value: x.id, label: x.title ?? x.name ?? x.id }));
const field = (name: string, label: string, long = false): Spec => ({
  name,
  label,
  long,
});
function Comparison({
  examples,
  candidateId,
  submit,
}: {
  examples: EvaluationExample[];
  candidateId: string;
  submit: (v: unknown) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        submit({
          candidateId,
          cases: examples.map((x) => ({
            exampleId: x.id,
            baseline: Number(d.get(x.id + "-baseline")),
            candidate: Number(d.get(x.id + "-candidate")),
            baselineOutput: String(d.get(x.id + "-old")),
            candidateOutput: String(d.get(x.id + "-new")),
            notes: String(d.get(x.id + "-notes")),
          })),
        });
      }}
    >
      {examples.map((x) => (
        <fieldset key={x.id}>
          <legend>{x.prompt}</legend>
          <p>Expected: {x.expected}</p>
          {["baseline", "candidate"].map((k) => (
            <label className="camp-field" key={k}>
              {k} score (0–5)
              <input
                required
                name={x.id + "-" + k}
                type="number"
                min="0"
                max="5"
              />
            </label>
          ))}
          {[
            ["old", "Baseline output"],
            ["new", "Candidate output"],
            ["notes", "Review notes"],
          ].map(([k, l]) => (
            <label className="camp-field" key={k}>
              {l}
              <textarea required minLength={3} name={x.id + "-" + k} />
            </label>
          ))}
        </fieldset>
      ))}
      <button disabled={examples.length < 4}>Record held-out comparison</button>
    </form>
  );
}
export default function CulturalPanel({
  camp,
  act,
  post,
  read,
}: {
  camp: Camp;
  act: (fn: () => Promise<unknown>) => void;
  post: (route: string, data: unknown) => Promise<unknown>;
  read: (route: string) => Promise<unknown>;
}) {
  const [tab, setTab] = useState("Research"),
    [threads, setThreads] = useState<BoardThread[]>([]),
    [library, setLibrary] = useState<
      { id: string; title: string; camp: string; deployment: { url: string } }[]
    >([]);
  const [configuration, setConfiguration] = useState<{
    migration: string;
    gemini: { key: boolean; monthlyUsd: number };
    gmail: boolean;
    github: boolean;
    slack: boolean;
  } | null>(null);
  useEffect(() => {
    let live = true;
    void fetch("/api/camps/configuration")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (live) setConfiguration(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([read("board"), read("library")])
      .then(([b, l]) => {
        if (live) {
          setThreads((b as { threads: BoardThread[] }).threads);
          setLibrary((l as { publications: typeof library }).publications);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [camp.id, camp.revision, read]);
  const s = camp.cultural;
  if (!s)
    return (
      <p>
        Create an America or China camp to open a cultural research workspace.
      </p>
    );
  const submit = (route: string) => (data: unknown) =>
    act(() => post(route, data));
  const pubs: Spec = {
    name: "publicationId",
    label: "Publication",
    options: options(camp.publications),
  };
  return (
    <>
      <span className="camp-eyebrow">CULTURAL MIMETICS</span>
      <h2>
        {s.focus === "america" ? "American" : "Chinese"} research workshop
      </h2>
      {configuration && (
        <details className="camp-card">
          <summary>
            Setup ·{" "}
            {configuration.gemini.key
              ? `$${configuration.gemini.monthlyUsd}/month model budget`
              : "Gemini key required"}
          </summary>
          <p>
            Local PostgreSQL and file artifacts. Prior database migration:{" "}
            {configuration.migration}.
          </p>
          <p>
            Gemini:{" "}
            {configuration.gemini.key
              ? "key configured; live validation required"
              : "add CAMP_GEMINI_API_KEY in private configuration"}
            . Monthly reservations stop new requests at $
            {configuration.gemini.monthlyUsd}; the Google account also has its
            own cap.
          </p>
          <p>
            Gmail: {configuration.gmail ? "configured" : "OAuth setup required"}
            . GitHub and Slack credentials must be validated before live use.
            Slack channel: {camp.slack?.channelId ?? "not bound"}.
          </p>
        </details>
      )}
      <div className="camp-row">
        {["Research", "Boards", "Outreach", "Learning"].map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Research" && (
        <>
          <p>
            Four roles work in sequence. Waiting agents sleep until inputs,
            quota, or your review are available.
          </p>
          <Entry
            title="Start a publication workflow"
            fields={[pubs]}
            submit={submit("cultural/workflow")}
            button="Start workflow"
          />
          {s.tasks.map((t) => (
            <section className="camp-card" key={t.id}>
              <strong>
                {t.role} · {t.status.replaceAll("_", " ")}
              </strong>
              <p>{t.output}</p>
              {t.notBefore && (
                <p>Resume after {new Date(t.notBefore).toLocaleString()}</p>
              )}
              {t.status === "waiting_input" && t.dependsOn.length === 0 && (
                <button onClick={() => submit("cultural/resume")({ id: t.id })}>
                  Inputs ready — resume
                </button>
              )}
            </section>
          ))}
          <h3>Source dossiers</h3>
          {s.sources.map((d) => (
            <details className="camp-card" key={d.id}>
              <summary>
                {d.author} · {d.edition}
              </summary>
              <blockquote>{d.quote}</blockquote>
              <p>
                {d.locator} · {d.language} · {d.translation}
              </p>
              <p>{d.relevance}</p>
              <p>{d.limitations}</p>
            </details>
          ))}
          <Entry
            title="Document a source passage"
            fields={[
              {
                name: "evidenceId",
                label: "Retained evidence",
                options: options(camp.evidence),
              },
              {
                name: "kind",
                label: "Source type",
                options: [
                  { value: "primary", label: "Primary source" },
                  {
                    value: "secondary",
                    label: "Jamestown / Palladium analysis",
                  },
                ],
              },
              ...[
                ["author", "Author"],
                ["edition", "Edition"],
                ["date", "Original date"],
                ["language", "Language"],
                ["translation", "Translation or original"],
                ["locator", "Page / section"],
                ["quote", "Exact retained quotation"],
                ["relevance", "Relevance"],
                ["limitations", "Limitations"],
              ].map(([n, l]) =>
                field(n, l, ["quote", "relevance", "limitations"].includes(n)),
              ),
            ]}
            submit={submit("cultural/sources")}
          />
          <h3>Argument map</h3>
          {s.connections.map((c) => (
            <section className="camp-card" key={c.id}>
              <strong>{c.kind.replaceAll("_", " ")}</strong>
              <p>{c.claim}</p>
              <p>{c.support}</p>
              <p>Counterexample: {c.counterexample}</p>
            </section>
          ))}
          <Entry
            title="Connect documented sources"
            fields={[
              {
                name: "first",
                label: "First source",
                options: options(
                  s.sources.map((d) => ({
                    id: d.id,
                    title: d.author + " · " + d.locator,
                  })),
                ),
              },
              {
                name: "second",
                label: "Second source",
                options: options(
                  s.sources.map((d) => ({
                    id: d.id,
                    title: d.author + " · " + d.locator,
                  })),
                ),
              },
              {
                name: "kind",
                label: "Relationship",
                options: [
                  "analogy",
                  "documented_transmission",
                  "contradiction",
                ].map((value) => ({
                  value,
                  label: value.replaceAll("_", " "),
                })),
              },
              field("claim", "Claim", true),
              field("support", "Supporting evidence", true),
              field(
                "counterexample",
                "Counterexample or rival explanation",
                true,
              ),
            ]}
            submit={(d) =>
              submit("cultural/connections")({
                ...d,
                sourceIds: [d.first, d.second],
              })
            }
          />
        </>
      )}
      {tab === "Boards" && (
        <>
          <h3>Correspondence</h3>
          <p>
            Two shared threads per camp per day; four agent contributions per
            thread. Private threads stay in their camp.
          </p>
          <Entry
            title="Open a thread"
            fields={[
              field("title", "Thread title"),
              {
                name: "visibility",
                label: "Audience",
                options: [
                  { value: "camp", label: "This camp" },
                  { value: "shared", label: "All your camps" },
                ],
              },
              field("text", "Message", true),
            ]}
            submit={submit("board")}
          />
          {threads.map((t) => (
            <section className="camp-card" key={t.id}>
              <h3>{t.title}</h3>
              <small>{t.visibility}</small>
              {t.posts.map((p) => (
                <div key={p.id}>
                  <strong>
                    {p.sender} · {p.campId}
                  </strong>
                  <p>{p.text}</p>
                </div>
              ))}
              <Entry
                title="Reply"
                fields={[field("text", "Reply", true)]}
                submit={(d) => submit("board")({ ...d, threadId: t.id })}
              />
            </section>
          ))}
          <h3>Released work from other camps</h3>
          {library.map((p) => (
            <p key={p.id}>
              <a href={p.deployment.url} target="_blank" rel="noreferrer">
                {p.title}
              </a>{" "}
              · {p.camp}
            </p>
          ))}
        </>
      )}
      {tab === "Outreach" && (
        <>
          <p>
            Every message requires your exact approval. Gmail sends through the
            configured sender. Forum contributions are posted manually in your
            browser.
          </p>
          <Entry
            title="Record a discussion venue"
            fields={[
              field("name", "Venue"),
              field("url", "Venue URL"),
              field("rules", "Submission rules", true),
              field("relevance", "Why this audience", true),
              { ...field("contact", "Public email contact"), optional: true },
              {
                ...field("contactSource", "Contact provenance URL"),
                optional: true,
              },
            ]}
            submit={(d) =>
              submit("cultural/venues")(
                Object.fromEntries(Object.entries(d).filter(([, v]) => v)),
              )
            }
          />
          {s.venues.map((v) => (
            <p key={v.id}>
              <a href={v.url} target="_blank" rel="noreferrer">
                {v.name}
              </a>{" "}
              — {v.relevance}
            </p>
          ))}
          <Entry
            title="Prepare correspondence"
            fields={[
              pubs,
              {
                name: "channel",
                label: "Channel",
                options: [
                  { value: "gmail", label: "Gmail" },
                  { value: "forum", label: "Manual forum post" },
                ],
              },
              field("destination", "Recipient email or discussion URL"),
              field("subject", "Subject / title"),
              field("text", "Exact contribution", true),
            ]}
            submit={submit("cultural/outbound")}
          />
          {s.outbox.map((o) => (
            <section className="camp-card" key={o.id}>
              <h3>{o.subject}</h3>
              <p>
                {o.channel} · {o.status} · revision {o.version}
              </p>
              <p>
                {o.sender && `${o.sender} → `}
                {o.destination}
              </p>
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {o.text}
              </blockquote>
              {o.status === "draft" && (
                <button
                  onClick={() => submit("cultural/approve")({ id: o.id })}
                >
                  Approve exact message and destination
                </button>
              )}
              {o.status === "approved" && o.channel === "forum" && (
                <>
                  <div className="camp-row">
                    <button
                      onClick={() =>
                        act(() => navigator.clipboard.writeText(o.text))
                      }
                    >
                      Copy approved contribution
                    </button>
                    <a href={o.destination} target="_blank" rel="noreferrer">
                      Open discussion
                    </a>
                  </div>
                  <Entry
                    title="Record my posted contribution"
                    fields={[field("url", "Public post URL")]}
                    submit={(d) =>
                      submit("cultural/forum-receipt")({ ...d, id: o.id })
                    }
                  />
                </>
              )}
              {o.receipt && (
                <p>
                  {o.receipt.detail} {o.receipt.ref}
                </p>
              )}
            </section>
          ))}
          <Entry
            title="Suppress a destination across your camps"
            fields={[field("destination", "Email or forum URL")]}
            submit={submit("cultural/suppress")}
          />
          <h3>Influence evidence</h3>
          {s.influence.map((i) => (
            <p key={i.id}>
              {i.kind} · {i.internal ? "internal" : "independent"}:{" "}
              <a href={i.url}>{i.detail}</a>
            </p>
          ))}
          <Entry
            title="Record a verified response"
            fields={[
              pubs,
              {
                name: "kind",
                label: "Evidence",
                options: ["citation", "discussion", "reuse", "followup"].map(
                  (value) => ({ value, label: value }),
                ),
              },
              field("url", "Evidence URL"),
              field("detail", "What happened", true),
              {
                name: "internal",
                label: "Origin",
                options: [
                  { value: "false", label: "Independent response" },
                  { value: "true", label: "Another camp" },
                ],
              },
            ]}
            submit={(d) =>
              submit("cultural/influence")({
                ...d,
                internal: d.internal === "true",
              })
            }
          />
        </>
      )}
      {tab === "Learning" && (
        <>
          <p>
            Review twelve examples per role: eight development examples and four
            held-out examples. Agents see development examples only. Skills must
            improve held-out results before promotion.
          </p>
          <Entry
            title="Add a reviewed example"
            fields={[
              { name: "role", label: "Role", options: options(camp.agents) },
              {
                name: "split",
                label: "Use",
                options: [
                  { value: "development", label: "Development example" },
                  { value: "heldout", label: "Held-out evaluation" },
                ],
              },
              field("prompt", "Task", true),
              field("expected", "Expected result and criteria", true),
            ]}
            submit={submit("cultural/examples")}
          />
          {camp.agents.map((a) => (
            <details className="camp-card" key={a.id}>
              <summary>
                {a.role} ·{" "}
                {s.examples.filter((e) => e.role === a.id && e.reviewed).length}{" "}
                reviewed examples
              </summary>
              {s.examples
                .filter((e) => e.role === a.id)
                .map((e) => (
                  <div key={e.id}>
                    <strong>
                      {e.split} · {e.reviewed ? "reviewed" : "needs review"}
                    </strong>
                    <p>{e.prompt}</p>
                    <p>{e.expected}</p>
                    {!e.reviewed && (
                      <button
                        onClick={() =>
                          submit("cultural/examples/review")({
                            id: e.id,
                            prompt: e.prompt,
                            expected: e.expected,
                          })
                        }
                      >
                        Accept this example and criteria
                      </button>
                    )}
                  </div>
                ))}
            </details>
          ))}
          {camp.candidates.map((c) => (
            <details className="camp-card" key={c.id}>
              <summary>
                {c.name} · {c.status}
              </summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{c.content}</pre>
              <Comparison
                candidateId={c.id}
                examples={s.examples
                  .filter(
                    (e) =>
                      e.role === c.agentId &&
                      e.reviewed &&
                      e.split === "heldout",
                  )
                  .slice(0, 4)}
                submit={submit("cultural/evaluations")}
              />
            </details>
          ))}
          {s.evaluations.map((e) => (
            <p key={e.id}>
              Comparison for {e.candidateId}:{" "}
              {e.cases.reduce((n, c) => n + c.baseline, 0)} →{" "}
              {e.cases.reduce((n, c) => n + c.candidate, 0)}. Reviewed by{" "}
              {e.actorId}.
            </p>
          ))}
        </>
      )}
    </>
  );
}
