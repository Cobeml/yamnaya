import type { CulturalRole, EvaluationExample } from "./cultural";
const cases: Record<CulturalRole, [string, string][]> = {
  finder: [
    [
      "An archive hosts a 1900 author's original speech and a 2020 historian's introduction. Classify each.",
      "Speech is primary evidence of the speaker's claims; introduction is secondary and outside the contemporary allowlist.",
    ],
    [
      "A search snippet attributes a striking quotation to a philosopher. The scanned edition lacks that passage.",
      "Do not admit the quotation; retain the lead and seek an authenticated edition.",
    ],
    [
      "A Manchu document survives in translation only. What provenance must accompany it?",
      "Record original language/date, edition, translator and location; disclose that the translation was not independently checked.",
    ],
    [
      "Two websites repeat the same unattributed passage. Does this establish authenticity?",
      "No. Seek the original edition; duplicated copies are not independent provenance.",
    ],
    [
      "A tribal author's first-person account is available with a modern editor's interpretation.",
      "Distinguish the author's account from editorial analysis; identify the specific nation, date and mediation.",
    ],
    [
      "An original manifesto states that its program transformed all of society.",
      "It is primary evidence of the author's program and claim, not proof of its social effect.",
    ],
    [
      "A Jamestown article links an original institutional statement.",
      "Record the article as allowed secondary analysis; separately retrieve and document the original statement.",
    ],
    [
      "Palladium quotes an old text with an identifiable edition.",
      "Trace the quotation to that edition and retain the exact passage and context.",
    ],
    [
      "An unknown blog reproduces an alleged sacred text without an edition or translator.",
      "Keep it as an unverified discovery lead; do not admit it as an authenticated primary source.",
    ],
    [
      "A contemporary original poem appears on the author's own site.",
      "It can be primary evidence of that authored work; its claims about other people still need independent support.",
    ],
    [
      "A forum comment reports a historical event second-hand.",
      "Primary evidence of what the commenter said, not primary evidence of the event; do not bypass the secondary-source rule.",
    ],
    [
      "Two translations give opposite readings of a key term.",
      "Preserve both readings and provenance, flag the ambiguity, and avoid a confident single interpretation without justification.",
    ],
  ],
  referencer: [
    [
      "Two texts separated by centuries use a similar image, with no contact evidence.",
      "Classify as analogy and identify the missing transmission evidence.",
    ],
    [
      "A later author explicitly cites an earlier edition. Both passages are retained.",
      "Document citation-based transmission with passage references; avoid claiming that all later ideas derive from it.",
    ],
    [
      "Two source passages support competing interpretations of the same ritual.",
      "Record the contradiction and explain both readings without silently discarding either.",
    ],
    [
      "Two accounts describe a frontier but use the term for different institutions.",
      "Explain the contextual difference before proposing a comparison.",
    ],
    [
      "A symbol persists while its political meaning changes.",
      "Separate continuity of form from continuity of meaning and cite each period.",
    ],
    [
      "A proposed connection relies only on an English translation's shared wording.",
      "Flag translation-mediated similarity; inspect original terms before inferring a link.",
    ],
    [
      "A text makes a universal claim from one local example.",
      "Limit the inference and propose a counterexample or a test of its broader scope.",
    ],
    [
      "A camp essay cites another camp essay citing one original source.",
      "Trace back to the original; do not count the camps as independent corroboration.",
    ],
    [
      "The strongest-looking parallel has a plausible independent origin.",
      "State independent development as a rival explanation; do not label transmission as established.",
    ],
    [
      "A cited author rejects the earlier text it names.",
      "Citation documents contact but not agreement; describe rejection rather than adoption.",
    ],
    [
      "A comparison treats all Indigenous nations as one unchanging tradition.",
      "Disaggregate the relevant nations, periods and institutions; narrow the claim.",
    ],
    [
      "A Han/Manchu comparison omits mixed institutions and changing identities.",
      "Add contextual distinctions and evidence for interaction; avoid treating categories as fixed explanatory causes.",
    ],
  ],
  writer: [
    [
      "Turn a documented analogy into an opening paragraph for a theory essay.",
      "State the analogy as an interpretive proposal, preserve source references, and avoid claiming proven historical contact.",
    ],
    [
      "Write an experimental manifesto based on historical research.",
      "Mark the manifesto as original creative argument and keep supporting historical claims separately cited.",
    ],
    [
      "An appealing quotation has no source locator.",
      "Remove or flag it until provenance is available; do not fabricate a citation.",
    ],
    [
      "Create an interactive Quarto experiment requiring no external network.",
      "Use bundled assets and sandboxed code; explain what interaction reveals.",
    ],
    [
      "A rendered chart contradicts the prose conclusion.",
      "Investigate the mismatch and revise before review; a green render does not establish truth.",
    ],
    [
      "The operator imports a generated illustration into an approved draft.",
      "Create a new source revision, label the illustration, rerender and obtain new approval.",
    ],
    [
      "A novel cultural vocabulary borrows a source's sacred term.",
      "Explain the original context and label the new use as the camp's proposal.",
    ],
    [
      "Revise an essay after finding a material error in a source attribution.",
      "Correct the attribution, retain a correction note and rerender the revised work.",
    ],
    [
      "A speculative scene could be mistaken for an archival quotation.",
      "Identify it as invented or experimental and keep it distinct from retained quotations.",
    ],
    [
      "A Quarto page loads its core illustration from an authenticated Google URL.",
      "Import a permitted local asset so the published work does not depend on the operator's session.",
    ],
    [
      "A vivid argument is stronger rhetorically than the evidence supports.",
      "Narrow the factual claim and make the ambitious extension explicit as theory.",
    ],
    [
      "A new source edit follows publication approval.",
      "Invalidate the old approval; review the exact newly rendered bytes before release.",
    ],
  ],
  marketer: [
    [
      "Find a venue for an essay on ritual and cultural transmission.",
      "Use the venue's actual discussions and submission rules; explain topical relevance.",
    ],
    [
      "An email address appears on a researcher's public contact page.",
      "Retain the contact provenance and draft a specific contribution for exact operator review.",
    ],
    [
      "An approved email request times out after submission.",
      "Record an indeterminate outcome and inspect the account; do not automatically resend.",
    ],
    [
      "Sofiechan has no documented posting API available.",
      "Prepare a substantive contribution and manual copy/open workflow; verify the supplied public post URL.",
    ],
    [
      "A venue prohibits promotional links.",
      "Respect the rule and propose an allowed substantive contribution or a different venue.",
    ],
    [
      "A recipient asks for no further contact.",
      "Suppress the destination and cancel pending drafts for it.",
    ],
    [
      "A camp cites its sister camp's work.",
      "Record an internal citation separately from independent influence.",
    ],
    [
      "No analytics are available for a published essay.",
      "Leave readership unknown; record only observable responses and references.",
    ],
    [
      "A marketer wants to alter the recipient after approval.",
      "Require a new exact approval; the old approval does not cover the new destination.",
    ],
    [
      "A forum reply discusses the idea critically rather than endorsing it.",
      "Record substantive discussion accurately, without treating criticism as endorsement.",
    ],
    [
      "A public URL shows a different post from the approved contribution.",
      "Do not verify the receipt; request the correct link and preserve uncertainty.",
    ],
    [
      "A small audience offers detailed reuse while another venue yields shallow views.",
      "Record both accurately and prioritize evidence of durable intellectual use over unsupported reach claims.",
    ],
  ],
};
export function seedCulturalExamples(): EvaluationExample[] {
  return Object.entries(cases).flatMap(([role, items]) =>
    items.map(([prompt, expected], i) => ({
      id: `example-${role}-${i + 1}`,
      role: role as CulturalRole,
      split: i < 8 ? "development" : "heldout",
      prompt,
      expected,
      reviewed: false,
    })),
  );
}
