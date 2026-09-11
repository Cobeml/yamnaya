"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useState,
  Component,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Box,
  Tent,
  Plus,
  Play,
  Pause,
  ArrowUpRight,
  Send,
  GitBranch,
  BookOpen,
  Users,
  Settings2,
  X,
  ShieldCheck,
  Radio,
  ChevronRight,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { capabilityNames, type Camp, type Publication } from "@yamnaya/core";
import "./camps.css";
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <div className="camp-loading">Assembling the camp…</div>,
});
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="camp-loading">
        3D rendering is unavailable. All camp controls remain available.
      </div>
    ) : (
      this.props.children
    );
  }
}
type Summary = Pick<Camp, "id" | "name" | "domain" | "status" | "mode">;
type Panel = "cube" | "agents" | "publications" | "activity" | "settings";
async function api(route = "", data?: unknown) {
  const response = await fetch("/api/camps/" + route, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(data === undefined ? {} : { "Idempotency-Key": crypto.randomUUID() }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Camp request failed");
  return value.result ?? value;
}
function Form({
  children,
  onSubmit,
  label,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  label?: string;
}) {
  return (
    <form
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  );
}
const field = (d: FormData, key: string) => String(d.get(key) ?? "");
function Field({
  label,
  name,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  value?: string | number;
}) {
  return (
    <label className="camp-field">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={value}
        required
      />
    </label>
  );
}
function PublicationEditor({
  publication: p,
  camp,
  act,
  post,
}: {
  publication: Publication;
  camp: Camp;
  act: (fn: () => Promise<unknown>) => void;
  post: (route: string, data: unknown) => Promise<unknown>;
}) {
  const [name, setName] = useState("index.qmd"),
    [text, setText] = useState(p.files["index.qmd"] ?? ""),
    [version, setVersion] = useState(p.version),
    [newPath, setNewPath] = useState("");
  const preview = camp.jobs
    .slice()
    .reverse()
    .find(
      (j) =>
        j.kind === "tool" &&
        (j.result as { build?: { id: string } })?.build?.id === p.build?.id,
    )?.result as { previewUrl?: string } | undefined;
  function choose(file: string) {
    setName(file);
    setText(p.files[file] ?? "");
    setVersion(p.version);
  }
  const tool = (capability: string) =>
    act(() =>
      post("tools", { capability, arguments: { publicationId: p.id } }),
    );
  return (
    <article className="camp-publication">
      <div className="camp-row">
        <span className="camp-tag">
          {p.status} · v{p.version}
        </span>
        <a
          href={"https://github.com/" + p.repository}
          target="_blank"
          rel="noreferrer"
        >
          {p.repository} <ArrowUpRight size={12} />
        </a>
      </div>
      <h3>{p.title}</h3>
      <p className="camp-muted">
        Quarto sources → rendered preview → GitHub review → Pages
      </p>
      <div className="camp-row">
        <select
          aria-label="Publication file"
          value={name}
          onChange={(e) => choose(e.target.value)}
        >
          {Object.keys(p.files).map((f) => (
            <option key={f}>{f}</option>
          ))}
          {!p.files[name] && <option>{name}</option>}
        </select>
        <button onClick={() => choose(name)} title="Reload latest source">
          <RefreshCw size={14} />
        </button>
      </div>
      <textarea
        className="camp-source"
        aria-label="Quarto source"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="camp-row">
        <input
          aria-label="New source path"
          placeholder="reports/new-report.qmd"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
        />
        <button
          onClick={() => {
            if (newPath) {
              choose(newPath);
              setNewPath("");
            }
          }}
        >
          New file
        </button>
      </div>
      <div className="camp-row">
        <button
          className="camp-primary"
          onClick={() =>
            act(async () => {
              await post("publications/edit", {
                id: p.id,
                version,
                files: { [name]: text },
              });
              setVersion(version + 1);
            })
          }
        >
          Save revision
        </button>
        <button
          onClick={() => tool("publication.render")}
          disabled={camp.status !== "running"}
        >
          Render site
        </button>
      </div>
      {p.build && (
        <div className="camp-build">
          <strong>Build of revision {p.build.sourceVersion}</strong>
          {p.build.checks.map((c) => (
            <p key={c.name}>
              {c.passed ? "✓" : "×"} {c.name}
            </p>
          ))}
          <code title={p.build.digest}>{p.build.digest.slice(0, 24)}…</code>
          {preview?.previewUrl && (
            <a
              className="camp-link-button"
              href={preview.previewUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open rendered preview <ArrowUpRight size={14} />
            </a>
          )}
          <div className="camp-row">
            <button onClick={() => tool("github.propose")}>
              Create GitHub PR
            </button>
            <button
              onClick={() =>
                act(() =>
                  post("publications/approve", {
                    id: p.id,
                    version: p.version,
                  }),
                )
              }
              disabled={!!p.approval}
            >
              Approve this build
            </button>
          </div>
        </div>
      )}
      {p.pullRequest && (
        <a href={p.pullRequest.url} target="_blank" rel="noreferrer">
          Review source pull request <ArrowUpRight size={14} />
        </a>
      )}
      {p.approval && (
        <p className="camp-muted">
          Revision {p.approval.version} approved. Publishing merges its PR and
          deploys the reviewed artifact to GitHub Pages.
        </p>
      )}
      <button
        className="camp-primary"
        disabled={!p.approval || !p.pullRequest || camp.status !== "running"}
        onClick={() => tool("publication.publish")}
      >
        Publish to GitHub Pages
      </button>
      {p.deployment && (
        <a
          className="camp-link-button"
          href={p.deployment.url}
          target="_blank"
          rel="noreferrer"
        >
          Visit published site <ArrowUpRight size={14} />
        </a>
      )}
      {p.history.length > 0 && (
        <details>
          <summary>Source history</summary>
          {p.history
            .slice()
            .reverse()
            .map((h) => (
              <div className="camp-row" key={h.version}>
                <span>Revision {h.version}</span>
                <button
                  onClick={() =>
                    act(() =>
                      post("publications/rollback", {
                        id: p.id,
                        version: h.version,
                      }),
                    )
                  }
                >
                  Restore as new revision
                </button>
              </div>
            ))}
        </details>
      )}
    </article>
  );
}
export default function CampConsole({archiveUrl="http://localhost:3100"}:{archiveUrl?:string}) {
  const [signedIn, setSignedIn] = useState(false),
    [loading, setLoading] = useState(true),
    [camps, setCamps] = useState<Summary[]>([]),
    [id, setId] = useState(""),
    [camp, setCamp] = useState<Camp | null>(null),
    [panel, setPanel] = useState<Panel>("cube"),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState(""),
    [recipient, setRecipient] = useState("camp");
  const refresh = useCallback(async () => {
    try {
      const session = await api("session");
      setSignedIn(!!session.actor);
      if (!session.actor) {
        setCamp(null);
        return;
      }
      const result = await api();
      setCamps(result.camps);
      const current = id || result.camps[0]?.id;
      if (current) {
        if (!id) setId(current);
        setCamp(await api(current));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camp service unavailable");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const post = (route: string, data: unknown) => api(id + "/" + route, data);
  const agent = camp?.agents.find((a) => a.id === selected) ?? camp?.agents[0];
  const config = agent?.configurations.find(
    (c) => c.id === agent.configurationId,
  );
  const selectAgent = (agentId: string) => {
    setSelected(agentId);
    setPanel("agents");
  };
  async function send(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await post("instructions", { text: message, recipientId: recipient });
      setMessage("");
    });
  }
  return (
    <main className="camp-app" aria-busy={busy}>
      <aside className="camp-rail">
        <a href="/" className="camp-brand">
          <span>Y</span>
          <div>
            YAMNAYA<small>COMPUTER MANEUVER</small>
          </div>
        </a>
        <div className="camp-rail-heading">
          YOUR CAMPS
          <button
            aria-label="Create camp"
            onClick={() => setCreating(true)}
            disabled={!signedIn}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="camp-list">
          {camps.map((c) => (
            <button
              key={c.id}
              className={id === c.id ? "active" : ""}
              onClick={() => {
                setId(c.id);
                setSelected("");
              }}
            >
              <Tent size={19} />
              <span>
                {c.name}
                <small>
                  {c.domain} · {c.status}
                </small>
              </span>
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        {signedIn && !camps.length && (
          <p className="camp-muted">
            Establish your first camp. Give it a purpose and a set of tools.
          </p>
        )}
        <div className="camp-rail-bottom">
          <p>
            One ontology.
            <br />
            Many possible missions.
          </p>
          <a href={archiveUrl}>
            <ShieldCheck size={15} /> Utility archive <ArrowUpRight size={12} />
          </a>
          <button
            onClick={() => void act(() => api("logout", {}))}
            disabled={!signedIn}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <section className="camp-main">
        <header className="camp-top">
          <div>
            <span className="camp-eyebrow">
              FIELD STATION /{" "}
              {camp?.domain === "cyber"
                ? "CYBER OPERATIONS"
                : "RESEARCH & PUBLISHING"}
            </span>
            <h1>{camp?.name ?? "An open field"}</h1>
          </div>
          <div className="camp-row">
            <span
              className={
                "camp-status " + (camp?.status === "running" ? "live" : "")
              }
            >
              <i />
              {camp?.status ?? "AWAITING OPERATOR"}
            </span>
            {camp && (
              <button
                disabled={busy || camp.status === "archived"}
                onClick={() =>
                  void act(() =>
                    post("status", {
                      status: camp.status === "running" ? "paused" : "running",
                    }),
                  )
                }
              >
                {camp.status === "running" ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}{" "}
                {camp.status === "running" ? "Pause" : "Start"} camp
              </button>
            )}
          </div>
        </header>
        <div className="camp-stage">
          <SceneBoundary>
            <Scene
              agents={camp?.agents ?? []}
              selected={selected}
              onAgent={selectAgent}
              onCube={() => setPanel("cube")}
            />
          </SceneBoundary>
          <div className="camp-scene-note">
            <Radio size={12} />
            {camp?.mode === "live" ? "LIVE CAMP" : "SIMULATION"}
            <span>Drag to orbit · Scroll to explore</span>
          </div>
          <div className="camp-scene-caption">
            <span>THE CAMP IS A PLACE TO THINK.</span>
            <p>The cube is a place to act.</p>
          </div>
        </div>
        <div className="camp-mission-bar">
          <BookOpen size={20} />
          <div>
            <small>CURRENT MISSION</small>
            <p>
              {camp?.missions.filter((m) => m.status === "active").at(-1)
                ?.objective ??
                "No mission yet. Give the camp a question worth investigating."}
            </p>
          </div>
          {camp && (
            <button onClick={() => setPanel("cube")}>
              <ArrowUpRight size={17} />
            </button>
          )}
        </div>
      </section>
      <aside
        className={"camp-inspector " + (panel === "publications" ? "wide" : "")}
      >
        <nav className="camp-tabs">
          {(
            [
              { id: "cube", Icon: Box, label: "Cube" },
              { id: "agents", Icon: Users, label: "Agents" },
              { id: "publications", Icon: BookOpen, label: "Sites" },
              { id: "activity", Icon: Radio, label: "Log" },
              { id: "settings", Icon: Settings2, label: "Setup" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={panel === t.id ? "active" : ""}
              onClick={() => setPanel(t.id)}
              title={t.label}
            >
              <t.Icon size={17} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        {error && (
          <div className="camp-error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={13} />
            </button>
          </div>
        )}
        {loading ? (
          <p className="camp-muted">Opening the station…</p>
        ) : !signedIn ? (
          <div className="camp-panel">
            <span className="camp-eyebrow">OPERATOR ACCESS</span>
            <h2>Enter the camp.</h2>
            <p>
              Give direction. Equip your agents. Review what they bring back.
            </p>
            <Form
              label="Operator sign in"
              onSubmit={(d) =>
                void act(() =>
                  api("session", { password: field(d, "password") }),
                )
              }
            >
              <Field
                label="Operator password"
                name="password"
                type="password"
              />
              <button className="camp-primary" disabled={busy}>
                Sign in
              </button>
            </Form>
            <p className="camp-muted">
              Local setup: run <code>pnpm camps:setup</code>. Your password is
              stored in the private .env.camps file.
            </p>
          </div>
        ) : !camp ? (
          <div className="camp-panel">
            <h2>A purpose needs a place.</h2>
            <p>Create a camp to bring agents, tools and a mission together.</p>
            <button className="camp-primary" onClick={() => setCreating(true)}>
              Establish a camp
            </button>
          </div>
        ) : (
          <div className="camp-panel" key={camp.id}>
            {panel === "cube" && (
              <>
                <span className="camp-eyebrow">OPERATOR → WORLD</span>
                <h2>The black cube</h2>
                <p className="camp-muted">
                  Instructions, resources and authority enter here. Agents
                  gather at the cube when they use an external tool.
                </p>
                <Form
                  label="Create mission"
                  onSubmit={(d) =>
                    void act(() =>
                      post("missions", { objective: field(d, "objective") }),
                    )
                  }
                >
                  <label className="camp-field">
                    Mission
                    <textarea
                      name="objective"
                      placeholder="What should this camp accomplish?"
                      required
                      minLength={5}
                    />
                  </label>
                  <button className="camp-primary">Set mission</button>
                </Form>
                {camp.cyber && (
                  <section className="camp-card">
                    <h3>Cyber mission</h3>
                    <p>
                      {camp.cyber.status} · {camp.cyber.plans.length} plans
                    </p>
                    {camp.cyber.plans.map((plan) => (
                      <details key={plan.id}>
                        <summary>
                          {plan.title} / v{plan.version} · {plan.status}
                        </summary>
                        <p>{plan.rationale}</p>
                        <ol>
                          {plan.steps.map((step, i) => (
                            <li key={i}>
                              {i < plan.stepIndex ? "✓ " : ""}
                              {step.kind.replaceAll("_", " ")}
                            </li>
                          ))}
                        </ol>
                        <div className="camp-row">
                          <button
                            onClick={() =>
                              void act(() =>
                                post("cyber", {
                                  operation: "rehearse",
                                  planId: plan.id,
                                }),
                              )
                            }
                          >
                            Rehearse
                          </button>
                          <button
                            onClick={() =>
                              void act(() =>
                                post("cyber", {
                                  operation: "execute",
                                  planId: plan.id,
                                }),
                              )
                            }
                          >
                            Queue execution
                          </button>
                        </div>
                        {plan.requiredRoles.map((role) => (
                          <button
                            key={role}
                            disabled={plan.approvals.some(
                              (a) =>
                                a.role === role && a.decision === "approved",
                            )}
                            onClick={() =>
                              void act(() =>
                                post("cyber", {
                                  operation: "approve",
                                  planId: plan.id,
                                  version: plan.version,
                                  role,
                                  decision: "approved",
                                }),
                              )
                            }
                          >
                            Approve as {role}
                          </button>
                        ))}
                      </details>
                    ))}
                    <Form
                      onSubmit={(d) =>
                        void act(() =>
                          post("cyber", {
                            operation: "confirm-field",
                            sdpIds: field(d, "sdps").trim().split(/\s+/),
                          }),
                        )
                      }
                    >
                      <Field
                        label="Confirmed field service points"
                        name="sdps"
                        placeholder="SDP-001 SDP-002"
                      />
                      <button>Record operations confirmation</button>
                    </Form>
                  </section>
                )}
                <div className="camp-section-title">
                  CAMP CONVERSATION <span>{camp.messages.length}</span>
                </div>
                <div className="camp-messages">
                  {camp.messages.slice(-12).map((m) => (
                    <article key={m.id}>
                      <div>
                        <strong>
                          {camp.agents.find((a) => a.id === m.senderId)?.name ??
                            "Operator"}
                        </strong>
                        <time>
                          {new Date(m.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p>{m.text}</p>
                    </article>
                  ))}
                  {!camp.messages.length && (
                    <p className="camp-muted">
                      A quiet camp. Start the conversation.
                    </p>
                  )}
                </div>
                <form onSubmit={send}>
                  <select
                    aria-label="Message recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    <option value="camp">Whole camp</option>
                    {camp.agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <label className="camp-field">
                    <textarea
                      aria-label="Instruction"
                      placeholder="Give an instruction or ask a question…"
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  <button className="camp-primary" disabled={busy}>
                    <Send size={14} /> Send instruction
                  </button>
                </form>
                {camp.missions
                  .filter((m) => m.status !== "accepted")
                  .map((m) => (
                    <div className="camp-card" key={m.id}>
                      <p>{m.objective}</p>
                      <button
                        onClick={() =>
                          void act(() => post("missions/accept", { id: m.id }))
                        }
                      >
                        Accept mission outcome
                      </button>
                    </div>
                  ))}
              </>
            )}
            {panel === "agents" && (
              <>
                <span className="camp-eyebrow">PEOPLE & LINEAGE</span>
                <h2>Camp residents</h2>
                <div className="camp-roster">
                  {camp.agents.map((a) => (
                    <button
                      key={a.id}
                      className={agent?.id === a.id ? "active" : ""}
                      onClick={() => setSelected(a.id)}
                    >
                      <span className="camp-avatar">{a.name[0]}</span>
                      <span>
                        {a.name}
                        <small>{a.role}</small>
                      </span>
                      <em>{a.activity}</em>
                    </button>
                  ))}
                </div>
                {agent && (
                  <>
                    <div className="camp-section-title">
                      {agent.name.toUpperCase()} / {agent.configurationId}
                    </div>
                    <p>{config?.persona}</p>
                    <p className="camp-muted">
                      {agent.turns} completed turns · {config?.skills.length}{" "}
                      approved skills
                    </p>
                    {config?.parentRefs.length !== 0 && (
                      <p className="camp-muted">
                        Derived from {config?.parentRefs.join(", ")}
                      </p>
                    )}
                    <details>
                      <summary>Configuration history & skills</summary>
                      {agent.configurations.map((c) => (
                        <div className="camp-card" key={c.id}>
                          <strong>{c.id}</strong>
                          <p>
                            {c.skills.map((s) => s.name).join(", ") ||
                              "No additional skills"}
                          </p>
                          <button
                            disabled={c.id === agent.configurationId}
                            onClick={() =>
                              void act(() =>
                                post("agents/configuration", {
                                  agentId: agent.id,
                                  configurationId: c.id,
                                }),
                              )
                            }
                          >
                            Use configuration
                          </button>
                        </div>
                      ))}
                    </details>
                    <Form
                      label="Train agent"
                      onSubmit={(d) =>
                        void act(() =>
                          post("agents/train", {
                            agentId: agent.id,
                            exercise: field(d, "exercise"),
                          }),
                        )
                      }
                    >
                      <Field
                        label="Training exercise"
                        name="exercise"
                        placeholder="Practice a method and verify its outcome"
                      />
                      <button>Train {agent.name}</button>
                    </Form>
                  </>
                )}
                {camp.candidates
                  .filter(
                    (c) => c.agentId === agent?.id && c.status !== "promoted",
                  )
                  .map((c) => (
                    <article className="camp-card" key={c.id}>
                      <h3>{c.name}</h3>
                      <pre>{c.content}</pre>
                      <p>{c.status}</p>
                      {c.checks.map((t) => (
                        <p key={t.name}>
                          {t.passed ? "✓" : "×"} {t.name}
                        </p>
                      ))}
                      <button
                        onClick={() =>
                          void act(() =>
                            post(
                              c.status === "proposed"
                                ? "skills/evaluate"
                                : "skills/promote",
                              { id: c.id },
                            ),
                          )
                        }
                      >
                        {c.status === "proposed"
                          ? "Check candidate"
                          : "Promote reviewed skill"}
                      </button>
                    </article>
                  ))}
                <details>
                  <summary>
                    <GitBranch size={14} /> Derive a new agent
                  </summary>
                  <Form
                    onSubmit={(d) =>
                      void act(() =>
                        post("agents/breed", {
                          name: field(d, "name"),
                          parentIds: [
                            field(d, "parent"),
                            field(d, "second"),
                          ].filter(Boolean),
                        }),
                      )
                    }
                  >
                    <Field label="Name" name="name" />
                    <label className="camp-field">
                      First parent
                      <select name="parent">
                        {camp.agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="camp-field">
                      Second parent
                      <select name="second">
                        <option value="">None</option>
                        {camp.agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="camp-muted">
                      Copies selected configurations and approved skills. Tool
                      grants are provisioned separately.
                    </p>
                    <button>Create apprentice</button>
                  </Form>
                </details>
                <div className="camp-section-title">AT THE TABLE</div>
                <p className="camp-muted">
                  {camp.game.winner
                    ? "Result: " + camp.game.winner
                    : camp.game.next + " to move"}
                </p>
                <div className="camp-game">
                  {camp.game.board.map((v, i) => (
                    <button
                      aria-label={"Square " + (i + 1)}
                      key={i}
                      disabled={!!v || !!camp.game.winner}
                      onClick={() => void act(() => post("game", { cell: i }))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button onClick={() => void act(() => post("game/reset", {}))}>
                  New game
                </button>
              </>
            )}
            {panel === "publications" && (
              <>
                <span className="camp-eyebrow">RESEARCH INTO PUBLICATION</span>
                <h2>Reports & websites</h2>
                <p className="camp-muted">
                  Professional, evolving documents. Quarto sources live in
                  GitHub; reviewed sites publish to Pages.
                </p>
                {camp.publications.map((p) => (
                  <PublicationEditor
                    key={p.id}
                    publication={p}
                    camp={camp}
                    act={(fn) => void act(fn)}
                    post={post}
                  />
                ))}
                <details open={!camp.publications.length}>
                  <summary>Create a Quarto site</summary>
                  <Form
                    onSubmit={(d) =>
                      void act(() =>
                        post("publications", {
                          title: field(d, "title"),
                          repository: field(d, "repository"),
                          branch: field(d, "branch"),
                          projectDirectory: field(d, "directory"),
                        }),
                      )
                    }
                  >
                    <Field
                      label="Publication title"
                      name="title"
                      placeholder="The camp fieldnotes"
                    />
                    <Field
                      label="Existing GitHub repository"
                      name="repository"
                      placeholder="owner/repository"
                    />
                    <Field label="Source branch" name="branch" value="main" />
                    <label className="camp-field">
                      Project directory (optional)
                      <input
                        name="directory"
                        placeholder="Leave empty for repository root"
                      />
                    </label>
                    <button className="camp-primary">Create publication</button>
                  </Form>
                </details>
              </>
            )}
            {panel === "activity" && (
              <>
                <span className="camp-eyebrow">OBSERVATION & RECEIPTS</span>
                <h2>The camp journal</h2>
                <div className="camp-stats">
                  <span>
                    <strong>
                      {camp.jobs.filter((j) => j.status === "done").length}
                    </strong>{" "}
                    Completed
                  </span>
                  <span>
                    <strong>{camp.evidence.length}</strong> Sources
                  </span>
                  <span>
                    <strong>
                      {
                        camp.jobs.filter((j) =>
                          ["failed", "indeterminate"].includes(j.status),
                        ).length
                      }
                    </strong>{" "}
                    To inspect
                  </span>
                </div>
                {camp.jobs
                  .filter((j) => ["failed", "indeterminate"].includes(j.status))
                  .slice(-8)
                  .map((j) => (
                    <div className="camp-card" key={j.id}>
                      <strong>
                        {j.status}: {(j.input.capability as string) ?? j.kind}
                      </strong>
                      <p>{j.receipt?.detail}</p>
                      <code>{j.id}</code>
                    </div>
                  ))}
                {camp.evidence.map((e) => (
                  <details key={e.id}>
                    <summary>{e.title}</summary>
                    <a href={e.url} target="_blank" rel="noreferrer">
                      Source <ArrowUpRight size={12} />
                    </a>
                    <p>{e.excerpt}</p>
                    <code>{e.digest.slice(0, 24)}</code>
                  </details>
                ))}
                <ol className="camp-events">
                  {camp.events
                    .slice(-60)
                    .reverse()
                    .map((e) => (
                      <li key={e.id}>
                        <time>
                          {new Date(e.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <div>
                          <p>{e.detail}</p>
                          <small>
                            {e.actorId} · {e.type}
                          </small>
                        </div>
                      </li>
                    ))}
                </ol>
              </>
            )}
            {panel === "settings" && (
              <>
                <span className="camp-eyebrow">RESOURCES & AUTHORITY</span>
                <h2>Equip the camp</h2>
                <div className="camp-section-title">STANDING TOOL GRANTS</div>
                {camp.grants
                  .filter((g) => !g.revoked)
                  .map((g) => (
                    <div className="camp-card" key={g.id}>
                      <strong>{g.capability}</strong>
                      <p>
                        {g.agentId} · {g.scope}
                      </p>
                      <small>
                        Until {new Date(g.expiresAt).toLocaleString()}
                      </small>
                      <button
                        onClick={() =>
                          void act(() => post("grants/revoke", { id: g.id }))
                        }
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                <Form
                  onSubmit={(d) =>
                    void act(() =>
                      post("grants", {
                        agentId: field(d, "agent"),
                        capability: field(d, "capability"),
                        scope: field(d, "scope"),
                        expiresAt: new Date(
                          Date.now() + Number(field(d, "hours")) * 3600000,
                        ).toISOString(),
                      }),
                    )
                  }
                >
                  <label className="camp-field">
                    Agent
                    <select name="agent">
                      <option value="*">All camp agents</option>
                      {camp.agents
                        .filter((a) => a.id !== "attacker")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="camp-field">
                    Capability
                    <select name="capability">
                      {capabilityNames
                        .filter(
                          (c) =>
                            c !== "cyber.action" || camp.domain === "cyber",
                        )
                        .map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                    </select>
                  </label>
                  <Field
                    label="Scope: hostname, repository, camp ID, or *"
                    name="scope"
                    placeholder="example.org"
                  />
                  <Field
                    label="Valid for (hours)"
                    name="hours"
                    type="number"
                    value={24}
                  />
                  <button className="camp-primary">Grant through cube</button>
                </Form>
                {camp.domain === "cyber" && (
                  <Form
                    onSubmit={(d) =>
                      void act(() =>
                        post("settings", {
                          cyberRepository: field(d, "repository"),
                        }),
                      )
                    }
                  >
                    <Field
                      label="Cyber recovery GitHub repository"
                      name="repository"
                      value={camp.resources?.cyberRepository}
                      placeholder="owner/recovery-lab"
                    />
                    <button>Bind recovery repository</button>
                    <p className="camp-muted">
                      Grant cyber.action with scope synthetic to execute
                      authorized plans. Original role approvals and independent
                      verification still apply.
                    </p>
                  </Form>
                )}
                <div className="camp-section-title">CAMP RHYTHM</div>
                <Form
                  onSubmit={(d) =>
                    void act(() =>
                      post("settings", {
                        missionLimit: Number(field(d, "mission")),
                        socialLimit: Number(field(d, "social")),
                        refreshMinutes: Number(field(d, "refresh")),
                        socialEnabled: d.has("socialEnabled"),
                      }),
                    )
                  }
                >
                  <Field
                    label="Mission turns per day"
                    name="mission"
                    type="number"
                    value={camp.budgets.missionLimit}
                  />
                  <Field
                    label="Social turns per day"
                    name="social"
                    type="number"
                    value={camp.budgets.socialLimit}
                  />
                  <Field
                    label="Publication review interval (minutes; 0 disables)"
                    name="refresh"
                    type="number"
                    value={camp.schedule.refreshMinutes}
                  />
                  <label className="camp-check">
                    <input
                      type="checkbox"
                      name="socialEnabled"
                      defaultChecked={camp.schedule.socialEnabled}
                    />{" "}
                    Allow quiet camp conversations
                  </label>
                  <button>Save rhythm</button>
                </Form>
                <p className="camp-muted">
                  Today: {camp.budgets.missionTurns} mission turns,{" "}
                  {camp.budgets.socialTurns} social turns. Each turn permits at
                  most 24 model requests and 12 iterations.
                </p>
                <details>
                  <summary>Bind a Slack thread</summary>
                  <Form
                    onSubmit={(d) =>
                      void act(() =>
                        post("settings", {
                          slack: {
                            channelId: field(d, "channel"),
                            threadTs: field(d, "thread"),
                          },
                        }),
                      )
                    }
                  >
                    <Field
                      label="Channel ID"
                      name="channel"
                      value={camp.slack?.channelId}
                    />
                    <Field
                      label="Thread timestamp"
                      name="thread"
                      value={camp.slack?.threadTs}
                    />
                    <button>Bind thread</button>
                  </Form>
                  <p className="camp-muted">
                    Only configured Slack operators can issue instructions.
                    Provider credentials stay in the worker environment.
                  </p>
                </details>
                <details>
                  <summary>Camp lifecycle</summary>
                  <Form
                    onSubmit={(d) =>
                      void act(async () => {
                        const c = (await post("clone", {
                          name: field(d, "name"),
                        })) as Camp;
                        setId(c.id);
                      })
                    }
                  >
                    <Field label="Cloned camp name" name="name" />
                    <button>Clone configurations</button>
                  </Form>
                  <button
                    onClick={() =>
                      void act(() => post("status", { status: "archived" }))
                    }
                  >
                    Archive camp
                  </button>
                </details>
                <p className="camp-muted">
                  Future MCP tools attach through the same grant, job and
                  receipt boundary.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
      {creating && (
        <div className="camp-modal-backdrop">
          <section
            className="camp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-camp-title"
          >
            <button
              className="camp-close"
              onClick={() => setCreating(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="camp-eyebrow">A NEW PURPOSE</span>
            <h2 id="new-camp-title">Establish a camp.</h2>
            <Form
              onSubmit={(d) =>
                void act(async () => {
                  const c = await api("", {
                    name: field(d, "name"),
                    domain: field(d, "domain"),
                    cyberScenario: field(d, "cyberScenario"),
                    mode: field(d, "mode"),
                  });
                  setId(c.id);
                  setCamp(c);
                  setCreating(false);
                })
              }
            >
              <Field
                label="Camp name"
                name="name"
                placeholder="Institute for useful questions"
              />
              <label className="camp-field">
                Purpose
                <select name="domain">
                  <option value="research">Research & Quarto publishing</option>
                  <option value="cyber">Synthetic cyber mission</option>
                </select>
              </label>
              <label className="camp-field">
                Cyber scenario (cyber camps only)
                <select name="cyberScenario">
                  <option value="credential-leak">
                    Credential containment
                  </option>
                  <option value="contractor">
                    Code and meter-data recovery
                  </option>
                  <option value="pivot">Lateral pivot</option>
                  <option value="injection">
                    Untrusted support instructions
                  </option>
                </select>
              </label>
              <label className="camp-field">
                Runtime
                <select name="mode">
                  <option value="live">Live Hermes agents</option>
                  <option value="simulation">
                    Simulation (no model calls)
                  </option>
                </select>
              </label>
              <p className="camp-muted">
                Four analysts arrive for research. Cyber camps receive a
                defender and a synthetic adversary. Start the camp and provision
                tools when ready.
              </p>
              <button className="camp-primary" disabled={busy}>
                Create camp <Plus size={15} />
              </button>
            </Form>
          </section>
        </div>
      )}
    </main>
  );
}
