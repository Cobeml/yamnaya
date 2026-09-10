"use client";

import { useEffect, useState } from "react";
import { Code2, Database, Users, MapPin, Shield, Check, ArrowUpRight, Radio } from "lucide-react";
import { presentation, type PresentationState } from "../../lib/presentation";
import styles from "./present.module.css";

export default function Present() {
  const [state, setState] = useState<PresentationState>();
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(0);
  const [bound, setBound] = useState<string>();
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setBound(query.get("run") ?? undefined);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/state", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        if (!response.ok) {
          if (active) {
            if ([401, 403].includes(response.status)) setState(undefined);
            setProblem([401, 403].includes(response.status) ? "Sign in to view the mission" : "Connection interrupted — displayed evidence is stale");
          }
        } else {
          const value: PresentationState = await response.json();
          if (active) {
            if (query.get("run") && value.id !== query.get("run")) setProblem("The active run changed. This recording view is paused.");
            else { setState(value); setProblem(""); }
          }
        }
      } catch { if (active) setProblem("Connection interrupted — displayed evidence is stale"); }
      finally { if (active) timer = setTimeout(refresh, 1000); }
    }
    void refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => { active = false; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, []);

  const view = state ? presentation(state) : undefined;
  const number = (value: number) => value.toLocaleString("en-US");
  const status = problem ? "CONNECTION PAUSED" : view?.verified ? view.containment ? "CONTAINMENT VERIFIED" : "MISSION VERIFIED" : state?.status.toUpperCase() ?? "AWAITING SIGN IN";
  const events = state?.events.filter(e => !["clock.advanced", "worker.tick"].includes(e.type)).slice(-3).reverse() ?? [];
  return <main className={styles.stage} data-testid="presentation" data-run-id={state?.id ?? ""} data-mode={state?.mode ?? ""}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}><Shield size={30} strokeWidth={1.5} /> YAMNAYA <span>MISSION CONTROL</span></a>
      <div className={styles.context}><span className={styles.live}><Radio size={15} /> {state?.mode === "live" ? "LIVE AGENTS" : state?.mode === "replay" ? "REPLAY" : "SIMULATION REHEARSAL"}</span><span>SYNTHETIC UTILITY</span><span>{state?.id ?? bound ?? "—"}</span></div>
    </header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>THE MISSION{view?.containment ? " · CONTAINMENT" : ""}</p><h1>{view?.containment ? "Contain exposed access." : "Trustworthy meter operations."}<br /><span>{view?.containment ? "Keep meter operations running." : "Even as the attack changes."}</span></h1></div>
      <div className={`${styles.outcome} ${view?.verified && !problem ? styles.good : ""}`} data-testid="mission-status"><span className={styles.dot} />{status}<small>{state ? `${state.checks.filter(c => c.passed).length} / ${state.checks.length} independent checks passing` : "Authenticated operational evidence"}</small></div>
    </section>
    {problem && <div className={styles.problem} role="alert">{problem}{!state && <a href="/">Open dashboard to sign in <ArrowUpRight size={18} /></a>}</div>}
    {!state || !view ? <div className={styles.waiting}>The recording view displays the same authenticated evidence as the dashboard.</div> : <>
      <section className={styles.metrics} aria-label="Mission continuity">
        <div><small>AFFECTED SERVICE POINTS</small><strong>{state.affected.length}<span> / {state.servicePoints.length}</span></strong><p>{state.quarantinedSdps.length} selectively quarantined</p></div>
        <div><small>BULK AMI READS</small><strong data-testid="ami-count">{number(state.metrics.amiReads)}</strong><p>Separate simulated intake stream</p></div>
        <div><small>HEALTHY ASSET BATCHES</small><strong>{number(state.metrics.healthyProcessed)}</strong><p>{view.workers.length} active synchronization path{view.workers.length === 1 ? "" : "s"}</p></div>
        <div><small>PROVEN EXPOSED ACCESS</small><strong>{view.leaked.filter(c => c.status === "revoked").length}<span> / {view.leaked.length} blocked</span></strong><p>{view.passed("operators") ? "Authorized operator access preserved" : "Operator access needs verification"}</p></div>
      </section>
      <section className={styles.domains} aria-label="Four domains">
        <article><div className={styles.domainHead}><Code2 /><h2>Code</h2><span>01</span></div><h3>{view.passed("code") ? "Trusted code serving" : "Deployment needs repair"}</h3><p>{view.workers.map(w => `${w.name}: ${w.artifactId}`).join(" · ") || "No active worker"}</p><div className={styles.evidence}>{view.patch ? <><strong>{view.patch.validation === "tested" ? "Corrective mapping tested" : "Candidate awaiting tests"}</strong><span>{view.patch.digest.slice(0, 16)}</span>{view.patch.prUrl && <a href={view.patch.prUrl} target="_blank" rel="noreferrer">Corrective pull request <ArrowUpRight size={15} /></a>}</> : <><strong>{view.containment ? "Approved code remains active" : "Inspect → test → promote"}</strong><span>{view.containment ? "Execution integrity checked during containment" : "Corrective artifact not yet prepared"}</span></>}</div></article>
        <article><div className={styles.domainHead}><Database /><h2>Data</h2><span>02</span></div><h3>{view.passed("data") ? "Relationships aligned" : state.affected.length ? "Source disagreement" : "Source alignment pending"}</h3><p>{state.affected.length ? state.affected.join(" · ") : view.passed("data") ? "Meter associations match the source of record" : "Pending transactions need source reconciliation"}</p><div className={styles.evidence}><strong>{view.passed("cache") ? "Operator cache consistent" : "Cache verification pending"}</strong><span>{state.transactions.filter(t => t.status === "quarantined").length} held transactions · {state.transactions.filter(t => t.status === "failed").length} exceptions retained</span></div></article>
        <article><div className={styles.domainHead}><Users /><h2>Personnel</h2><span>03</span></div><h3>{view.plan ? `${view.approvals.length} current approvals` : "Owners ready to mobilize"}</h3><p>Security · Platform sponsor · Meter operations</p><div className={styles.evidence}><strong>{state.notifications.filter(n => n.deliveredVia === "slack" && n.status === "delivered").length} Slack deliveries confirmed</strong><span>{view.plan ? `${view.plan.id} v${view.plan.version} · ${view.current ? "current threat version" : "renewed review required"}` : "Decisions remain with authenticated people"}</span></div></article>
        <article><div className={styles.domainHead}><MapPin /><h2>Physical assets</h2><span>04</span></div><h3>{view.containment ? `${state.workOrders.filter(w => w.status === "held").length} affected work orders held` : `${view.fields.filter(w => w.status === "confirmed").length} / ${view.fields.length} field confirmations`}</h3><p>{view.containment ? "Digital field dispatch held for employee review" : "Installed meters checked against their digital records"}</p><div className={styles.evidence}><strong>{view.containment ? view.passed("physical") ? "Affected dispatch safely paused" : "Awaiting approved work hold" : view.passed("physical") ? "Operations acknowledgement verified" : "Awaiting trusted field evidence"}</strong><span>{view.containment ? "Electricity and meter readings stay on" : "Simulated installations · Human confirmation"}</span></div></article>
      </section>
      <section className={styles.lower}>
        <article className={styles.plan}><div className={styles.sectionTitle}><span>DEFENSIVE MANEUVER</span><span>{view.plan ? `${view.plan.id} v${view.plan.version} · ${view.plan.status}` : "OBSERVE → CONTEXTUALIZE → ACT"}</span></div><h2>{view.plan?.title ?? "Keep the mission stable. Change the defense."}</h2><p className={styles.rationale}>{view.plan?.rationale ?? "Yamnaya investigates the evidence, identifies dependencies, and coordinates bounded changes across all four domains."}</p><div className={styles.next} data-testid="next-action">{view.next}</div><div className={styles.checks}>{state.checks.map(c => <span key={c.id} title={c.detail} className={c.passed ? styles.passed : ""}><Check size={13} />{c.id}</span>)}</div></article>
        <article className={styles.activity}><div className={styles.sectionTitle}><span>RECORDED ACTIVITY</span><span>{state.events.length} EVENTS</span></div>{events.length ? events.map(e => <div className={styles.event} key={e.id}><span className={styles.eventDot} /><div><small>{e.actor} · {e.type} · #{e.sequence}</small><p>{e.message}</p></div></div>) : <p>Waiting for recorded actions.</p>}</article>
      </section>
    </>}
    <footer className={styles.footer}><span>CODE · DATA · PERSONNEL · PHYSICAL ASSETS</span><span>READ-ONLY OBSERVATION · {now ? new Date(now).toISOString().slice(11, 19) : "--:--:--"} UTC WALL CLOCK</span></footer>
  </main>;
}
