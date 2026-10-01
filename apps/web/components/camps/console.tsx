"use client";
import CulturalPanel from "./cultural-panel";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  Component,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Box,
  Plus,
  Play,
  Pause,
  ArrowUpRight,
  Send,
  GitBranch,
  BookOpen,
  Settings2,
  X,
  Radio,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { campActions, campProgress, agentBubble, missionReady, capabilityNames, type Camp, type Publication } from "@yamnaya/core";
import "./camps.css";
import GoogleImages from "./google-images";
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <div className="camp-loading">Loading camp…</div>,
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
      <div className="camp-loading camp-scene-unavailable">
        3D rendering is unavailable. Select an agent below.
      </div>
    ) : (
      this.props.children
    );
  }
}
type Summary = Pick<Camp, "id" | "name" | "domain" | "status" | "mode">;
type Panel =
  "research" | "cube" | "agents" | "publications" | "settings" | "none" | "person";
async function api(route = "", data?: unknown) {
  const response = await fetch("/api/camps" + (route ? "/" + route : ""), {
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
  useEffect(() => {
    const previous = p.history.find((entry) => entry.version === version)
      ?.files[name];
    if (version !== p.version && text === previous) {
      setText(p.files[name] ?? "");
      setVersion(p.version);
    }
  }, [p.version, p.files, p.history, name, text, version]);
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
      <GoogleImages camp={camp} publication={p} act={act} post={post} />
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
          {camp.discord && (
            <details>
              <summary>Approval command for Discord</summary>
              <p>
                Review the rendered preview first, then paste this command in
                the bound channel.
              </p>
              <code>
                !camp approve {p.id} v{p.version} {p.build.digest}
              </code>
            </details>
          )}
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
                    digest: p.build?.digest,
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
function LaunchBudget() {
  const [budget, setBudget] = useState<{
    reservedUsd: number;
    remainingUsd: number;
    fallback: boolean;
    reportedInputTokens: number;
    reportedOutputTokens: number;
    unreportedRequests: number;
    gemini?: {
      month: string;
      reservedUsd: number;
      limitUsd: number;
      remainingUsd: number;
    };
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const update = () =>
      api("launch-budget")
        .then((value) => {
          if (mounted) {
            setBudget(value);
            setError("");
          }
        })
        .catch(() => {
          if (mounted) setError("Budget status unavailable");
        });
    void update();
    const timer = setInterval(() => void update(), 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="camp-row">
      <div>
        <strong>Model budget</strong>
        {error && <p>{error}</p>}
        {budget ? (
          <>
            <p>
              Research:{" "}
              {budget.fallback
                ? "Gemini 3.8 Flash (Astra fallback active)"
                : "GPT-6 Astra"}
              . Writing and marketing: Gemini 3.8 Flash.
            </p>
            <p>
              Astra: ${budget.reservedUsd.toFixed(2)} in estimated charges and open
              reservations against the $50 application limit across both camps;
              ${budget.remainingUsd.toFixed(2)} available for new reservations.
            </p>
            {budget.gemini && (
              <p>
                Gemini ({budget.gemini.month}): $
                {budget.gemini.reservedUsd.toFixed(2)} in estimated charges and open
                reservations against the $
                {budget.gemini.limitUsd.toFixed(2)}; $
                {budget.gemini.remainingUsd.toFixed(2)} available for new
                reservations. A request waits if its maximum reservation
                exceeds the remainder.
              </p>
            )}
            <p className="camp-muted">
              OpenAI reported {budget.reportedInputTokens.toLocaleString()}{" "}
              input / {budget.reportedOutputTokens.toLocaleString()} output
              tokens. {budget.unreportedRequests} requests have no usage
              receipt. Billed spend is not connected. Completed calls use conservatively priced token receipts; calls without receipts retain their maximum hold.
              Reaching this guard does not mean the provider spending limit
              has been reached.
            </p>
          </>
        ) : (
          <p>Loading budget…</p>
        )}
      </div>
    </div>
  );
}

function CreateDialog({ children, close }: { children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="camp-modal camp-create-dialog" aria-labelledby="new-camp-title" onCancel={close} onClose={close}>{children}</dialog>;
}

export default function CampConsole() {
  const [signedIn, setSignedIn] = useState(false),
    [loading, setLoading] = useState(true),
    [camps, setCamps] = useState<Summary[]>([]),
    [showArchived, setShowArchived] = useState(false),
    [id, setId] = useState(""),
    [camp, setCamp] = useState<Camp | null>(null),
    [panel, setPanel] = useState<Panel>("none"),
    [clock, setClock] = useState(Date.now()),
    [collapsedActions, setCollapsedActions] = useState<string[]>([]),
    [actionIndex, setActionIndex] = useState(0),
    [lastSync, setLastSync] = useState(0),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState(""),
    [recipient, setRecipient] = useState("camp");
  const selectedCampId = useRef("");
  const latestCamp = useRef<Camp | null>(null);
  const refreshSequence = useRef(0);
  const chooseCamp = useCallback(
    (nextId: string, value: Camp | null = null) => {
      selectedCampId.current = nextId;
      refreshSequence.current++;
      setId(nextId);
      setPanel("none");
      setActionIndex(0);
      latestCamp.current = value;
      setCamp(value);
    },
    [],
  );
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const current = selectedCampId.current;
    try {
      const session = await api("session");
      if (sequence !== refreshSequence.current) return;
      setSignedIn(!!session.actor);
      if (!session.actor) {
        setCamp(null);
        return;
      }
      const result = await api();
      const target =
        current ||
        result.camps.find((c: Summary) => c.status !== "archived")?.id ||
        result.camps[0]?.id;
      const rev = target ? await api(target + "/revision") : null;
      const nextCamp = target
        ? latestCamp.current?.id === target &&
          latestCamp.current?.revision === rev.revision
          ? latestCamp.current
          : await api(target)
        : null;
      if (sequence !== refreshSequence.current) return;
      setCamps(result.camps);
      if (!current && target) {
        selectedCampId.current = target;
        setId(target);
      }
      latestCamp.current = nextCamp;
      setCamp(nextCamp);
      setLastSync(Date.now());
    } catch (e) {
      if (sequence === refreshSequence.current)
        setError(e instanceof Error ? e.message : "Camp service unavailable");
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      await refresh();
      // Starting another poll while this one is still reading invalidates its
      // sequence. On a slow browser that can discard every completed update.
      if (!stopped) timer = setTimeout(() => void poll(), 3000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refresh, id]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogOpen = panel !== "none" || (!signedIn && !loading);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (dialogOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!dialogOpen && dialogRef.current?.open) dialogRef.current?.close();
  }, [dialogOpen]);
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
  const readResource = useCallback(
    (route: string) => api(id + "/" + route),
    [id],
  );
  const post = (route: string, data: unknown) => api(id + "/" + route, data);
  const agent = camp?.agents.find((a) => a.id === selected) ?? camp?.agents[0];
  const config = agent?.configurations.find(
    (c) => c.id === agent.configurationId,
  );
  const selectAgent = (agentId: string) => {
    setSelected(agentId);
    setPanel("person");
  };
  async function send(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await post("instructions", { text: message, recipientId: recipient });
      setMessage("");
    });
  }
  const progress = camp ? campProgress(camp, clock) : null;
  const actions = camp ? campActions(camp) : [];
  const currentAction = actions[Math.min(actionIndex, Math.max(0, actions.length - 1))];
  const pauseControl = camp?.status === "running" && (progress?.active || !!progress?.until || progress?.label === "Ready for review" || progress?.label === "Idle");
  const stale = signedIn && lastSync > 0 && clock - lastSync > 20000;
  const bubbles = Object.fromEntries((camp?.agents ?? []).map(a => [a.id, camp && !stale ? agentBubble(camp, a.id, clock) : null]));
  const mission = camp?.missions.at(-1);
  return (
    <main className="camp-app" aria-busy={busy}>
      <section className="camp-main">
        <header className="camp-top">
          <a href="/" className="camp-wordmark">YAMNAYA</a>
          <label className="camp-switcher">
            <span className="sr-only">Camp</span>
            <select aria-label="Camp" value={id} onChange={e => chooseCamp(e.target.value)} disabled={!signedIn}>
              {!camps.length && <option value="">Choose camp</option>}
              {camps.filter(c => showArchived || c.status !== "archived").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button aria-label="Create camp" onClick={() => setCreating(true)} disabled={!signedIn}><Plus size={14} />New camp</button>
          <div className="camp-header-mission" title={mission?.objective}>{mission?.objective.split(/\n|\. /)[0] ?? "Set a mission at the cube"}</div>
          <span className={"camp-status " + (progress?.active && !stale ? "live" : "")} role="status">
            <i />{stale ? "Connection lost" : progress?.label ?? "Sign in"}
            {!stale && progress?.until && <> until {new Date(progress.until).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>}
          </span>
          {camp && <>
            <button disabled={busy || camp.status === "archived" || stale} onClick={() => void act(() => pauseControl ? post("status", { status: "paused" }) : post("run", {}))}>
              {pauseControl ? <Pause size={14} /> : <Play size={14} />}
              {pauseControl ? "Pause camp" : camp.jobs.length ? "Resume camp" : "Start camp"}
            </button>
            <button onClick={() => setPanel("cube")} aria-label="Cube"><Box size={15} />Instruct</button>
            <button onClick={() => setPanel("publications")}><BookOpen size={15} />Reports</button>
            <button onClick={() => setPanel("settings")} aria-label="Settings"><Settings2 size={15} /></button>
          </>}
        </header>
        <div className="camp-stage">
          <SceneBoundary>
            <Scene
              agents={camp?.agents ?? []}
              suspended={dialogOpen || creating}
              bubbles={bubbles}
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
          <div className="camp-accessible-agents" aria-label="Camp agents">
            {camp?.agents.map(a => <button key={a.id} onClick={() => selectAgent(a.id)}>{a.name}{bubbles[a.id] ? `: ${bubbles[a.id]!.text.slice(0, 100)}` : ""}</button>)}
          </div>
        </div>
      </section>
      {currentAction && <section className="camp-actions" aria-label="Action items">
        <div className="camp-action-heading">
          <strong>{camp?.name}</strong>
          <button aria-label={collapsedActions.includes(currentAction.id) ? "Expand action" : "Collapse action"}
            onClick={() => setCollapsedActions(ids => ids.includes(currentAction.id) ? ids.filter(x => x !== currentAction.id) : [...ids, currentAction.id])}>
            {collapsedActions.includes(currentAction.id) ? `${actions.length} pending` : <X size={14} />}
          </button>
        </div>
        {!collapsedActions.includes(currentAction.id) && <>
          <h3>{currentAction.title}</h3><p className="camp-action-detail">{currentAction.detail}</p>
          <button className="camp-primary" onClick={() => { setPanel(currentAction.target === "task" ? "cube" : currentAction.target); }}>{currentAction.target === "task" ? "Help agent" : "Review"}</button>
        </>}
        {actions.length > 1 && <button onClick={() => setActionIndex(i => (i + 1) % actions.length)}>Next · {Math.min(actionIndex + 1, actions.length)} of {actions.length}</button>}
      </section>}
      {error && !dialogOpen && <div className="camp-floating-error" role="alert">{error}<button onClick={() => void refresh()}>Reconnect</button></div>}
      <dialog ref={dialogRef} className="camp-inspector camp-dialog" aria-label={panel === "none" ? "Sign in" : panel === "publications" ? "Reports" : panel === "cube" ? "Instructions" : "Camp controls"}
        onCancel={e => { if (!signedIn) e.preventDefault(); else setPanel("none"); }} onClose={() => setPanel("none")}>
        {signedIn && <button className="camp-close" onClick={() => setPanel("none")} aria-label="Close panel"><X size={18} /></button>}
        {error && (
          <div className="camp-error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={13} />
            </button>
          </div>
        )}
        {loading ? (
          <p className="camp-muted">Loading…</p>
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
            <h2>Create a camp</h2>
            <p>Create a camp to bring agents, tools and a mission together.</p>
            <button className="camp-primary" onClick={() => setCreating(true)}>
              Establish a camp
            </button>
          </div>
        ) : (
          <div className="camp-panel" key={camp.id}>
            {panel === "cube" && (
              <>
                <h2>Instructions</h2>
                {camp.cultural?.tasks.filter(t => t.status === "waiting_input" && !t.dependsOn.length).map(t => <section className="camp-card" key={t.id}>
                  <strong>{camp.agents.find(a => a.id === t.role)?.name ?? t.role} needs input</strong><p>{t.output}</p>
                  <button disabled={busy} onClick={() => void act(() => post("cultural/resume", { id: t.id }))}>Inputs ready — resume</button>
                </section>)}
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
                  .filter((m) => m.status !== "accepted" && missionReady(camp, m.id))
                  .map((m) => (
                    <div className="camp-card" key={m.id}>
                      <p>{m.objective}</p>
                      <button
                        onClick={() =>
                          void act(() => post("missions/accept", { id: m.id }))
                        }
                      >
                        Accept finished work
                      </button>
                    </div>
                  ))}
              </>
            )}
            {panel === "person" && agent && <>
              <h2>{agent.name}</h2><p>{agent.role}</p>
              <p className="camp-current-message">{bubbles[agent.id]?.text ?? "Idle"}</p>
              <button onClick={() => { setRecipient(agent.id); setPanel("cube"); }}>Give instruction</button>
            </>}
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
            {panel === "research" && (
              <CulturalPanel
                camp={camp}
                act={act}
                post={post}
                read={readResource}
              />
            )}
            {panel === "settings" && (
              <>
                <span className="camp-eyebrow">RESOURCES & AUTHORITY</span>
                <h2>Settings</h2>
                {camp.status === "running" && <button onClick={() => void act(() => post("status", { status: "paused" }))}>Pause camp</button>}
                <nav className="camp-tabs"><button onClick={() => setPanel("agents")}>Agents</button><button onClick={() => setPanel("research")}>Research controls</button></nav>
                <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived camps</label>
                <button onClick={() => void act(() => api("logout", {}))}><LogOut size={15} />Sign out</button>
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
                      {camp.agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="camp-field">
                    Capability
                    <select name="capability">
                      {capabilityNames.map((c) => (
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
                {camp.cultural?.launch && <LaunchBudget />}
                <details>
                  <summary>Bind a Discord channel or thread</summary>
                  <Form
                    onSubmit={(d) =>
                      void act(() =>
                        post("settings", {
                          discord: {
                            channelId: field(d, "channel"),
                            guildId: field(d, "guild"),
                          },
                        }),
                      )
                    }
                  >
                    <Field
                      label="Channel or thread ID"
                      name="channel"
                      value={camp.discord?.channelId}
                    />
                    <Field
                      label="Server ID"
                      name="guild"
                      value={camp.discord?.guildId}
                    />
                    <button>Bind Discord</button>
                  </Form>
                  <p className="camp-muted">
                    Only allowlisted Discord operators can issue !camp commands.
                    Provider credentials stay in the worker environment.
                  </p>
                  {camp.discord && (
                    <button
                      type="button"
                      onClick={() =>
                        void act(() => post("settings", { discord: null }))
                      }
                    >
                      Disconnect Discord
                    </button>
                  )}
                  <p className="camp-muted">
                    Use !camp instruct followed by your instruction. Copy server
                    and channel IDs using Discord Developer Mode.
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
                        chooseCamp(c.id);
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
      </dialog>
      {creating && (
        <CreateDialog close={() => setCreating(false)}>
            <button
              className="camp-close"
              onClick={() => setCreating(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 id="new-camp-title">New camp</h2>
            <Form
              onSubmit={(d) =>
                void act(async () => {
                  const c = await api("", {
                    name: field(d, "name"),
                    domain: field(d, "domain"),
                    mode: field(d, "mode"),
                    ...(field(d, "focus") ? { focus: field(d, "focus") } : {}),
                  });
                  chooseCamp(c.id, c);
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
                  <option value="general">General purpose</option>
                </select>
              </label>
              <label className="camp-field">
                Cultural focus
                <select name="focus">
                  <option value="">General camp</option>
                  <option value="america">American cultural mimetics</option>
                  <option value="china">Chinese cultural mimetics</option>
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
                Four analysts arrive with complementary roles. Give the camp a
                mission and provision tools when ready.
              </p>
              <button className="camp-primary" disabled={busy}>
                Create camp <Plus size={15} />
              </button>
            </Form>
        </CreateDialog>
      )}
    </main>
  );
}
