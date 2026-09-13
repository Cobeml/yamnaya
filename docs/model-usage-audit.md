# Model accounting audit — September 13, 2026

The reported $48.12 Astra total is a cumulative application reservation, not
verified OpenAI spend. Treating the reservation guard as evidence that the
operator had spent their first-issue allowance was incorrect.

## Production evidence

Read-only inspection of the `spirits-first-issue` ledger found:

| Measurement | Value |
| --- | ---: |
| Maximum reservations | $48.120893 |
| Unique requests | 29 |
| Requests with token receipts | 27 |
| Reported input tokens | 368,645 |
| Reported output tokens | 4,875 |
| Requests without token receipts | 2 |
| Reservations without token receipts | $2.417475 |

The reservation sum matches the ledger total, with no duplicate request IDs.
All reservation timestamps fall between 15:31:54 and 16:02:21 UTC on September
13, 2026. The ledger does not import an earlier day's dashboard charges.
It includes smoke tests as well as America and China research requests.

## Why the number is inflated

`packages/core/src/launch.ts` reserves the following microdollars per request:

```text
ceil((serialized input bytes + 8192) × 12.5 + 16384 × 50)
```

It treats bytes as tokens, adds input overhead, applies the highest input
cache-write rate, and assumes the full output-token ceiling. Usage receipts
are recorded separately and never reduce the reservation. Failed requests
also retain their full reservation.

The 29 requests therefore reserved 475,136 output tokens, while the 27 saved
receipts report only 4,875. The output portion alone accounts for $23.7568 of
the reservation total. The persistent fallback uses this reservation total,
so it can activate well before actual spend reaches $50.

For scale only, applying the published $12.50/million cache-write input price
and $50/million output price to the recorded tokens produces $4.8518125 for
those 27 receipts. This is an illustrative calculation, not a reconciled bill;
it excludes the two missing receipts and assumes the highest input category.
See [Astra pricing](https://developers.openai.com/api/docs/models/gpt-6-astra).

## What remains unverified

The operator reports $0.41 for today and $30.89 from earlier usage. Neither
number has been independently matched to this project's requests. Local and
production model keys match and the gateway targets OpenAI directly, but
read-only calls to both `/v1/organization/costs` and
`/v1/organization/usage/completions` returned HTTP 403 with the configured key.
No billing-authorized credential is configured.

The Responses adapter retains input/output totals but discards cached-input,
cache-write and reasoning details. The persistent usage ledger also lacks
provider request IDs and the returned model identity. Historical totals cannot
establish exact billing categories or reconcile account/project/date filters.
OpenAI documents the required cache fields in its
[prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching).

## Correction and next accounting work

The dashboard now identifies both providers' values as cumulative maximum
reservations and explicitly says billed spend is not connected. Gemini uses
the same nonrefunded reservation approach; its $9.952743 total likewise does
not establish actual billed spend.

To make the guard reflect consumption, preserve the provider response/request
identity and complete billing-relevant token details, then atomically settle
completed reservations against a conservatively priced receipt. Keep unknown
outcomes reserved until reconciled, preserve idempotency, and check a daily
project-scoped billing export or authorized Costs API response separately.
Missing historical cache fields must not be invented. Match the operator's
dashboard project/date filters before attributing either dashboard total.

This audit made no model calls, budget changes, ledger resets or research
resumptions. Settlement and historical reconciliation remain unimplemented.
