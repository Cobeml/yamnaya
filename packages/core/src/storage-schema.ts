import { pgTable, text, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";
import type { Run } from "./contracts";
export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  state: jsonb("state").$type<Run>().notNull(),
});
export const control = pgTable("control", {
  key: text("key").primaryKey(),
  runId: text("run_id").notNull(),
});
export const audit = pgTable(
  "audit_events",
  {
    runId: text("run_id").notNull(),
    id: text("id").notNull(),
    sequence: integer("sequence").notNull(),
    event: jsonb("event").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.id] })],
);
export const objects = pgTable(
  "ontology_objects",
  {
    runId: text("run_id").notNull(),
    id: text("id").notNull(),
    type: text("type").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.id] })],
);
export const relationships = pgTable(
  "ontology_relationships",
  {
    runId: text("run_id").notNull(),
    id: text("id").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.id] })],
);
export const approvals = pgTable(
  "approvals",
  {
    runId: text("run_id").notNull(),
    id: text("id").notNull(),
    role: text("role").notNull(),
    actor: text("actor").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.id] })],
);
