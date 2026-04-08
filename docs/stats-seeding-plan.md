# ARD Stats Seeding Plan

## Objective
Seed all data from `ARD Stats/*.html` into Neon with a repeatable, auditable pipeline.

## Source Audit Summary
All 16 HTML files are Google Sheets waffle exports with these shared traits:
- A leading column-letter row (`A`, `B`, `C`, ...).
- A row-number column in column 1.
- 1 logical table per file.
- Many trailing preformatted empty rows (often through `2026-12-31`).

### File-by-file mapping
1. `Areeba.html` -> `fact_agent_daily_stats` (agent = `Areeba`)
2. `Doha.html` -> `fact_agent_daily_stats` (agent = `Doha`)
3. `Rehan.html` -> `fact_agent_daily_stats` (agent = `Rehan`)
4. `Sarwat.html` -> `fact_agent_daily_stats` (agent = `Sarwat`)
5. `Sehrish.html` -> `fact_agent_daily_stats` (agent = `Sehrish`)
6. `Zia.html` -> `fact_agent_daily_stats` (agent = `Zia`)
7. `Al Aswad Developers Pvt Ltd.html` -> `fact_project_daily_stats` (project = `Al Aswad Developers Pvt Ltd`)
8. `ARD Sales Support   UPH.html` -> `fact_team_daily_stats` (team = `ARD Sales Support / UPH`)
9. `UPH TOTAL .html` -> `fact_team_daily_stats` (team = `UPH TOTAL`)
10. `Weekly Report.html` -> `fact_weekly_snapshots`
11. `ARD Incoming Stats .html` -> `fact_incoming_interactions` (channel = `ARD Incoming`)
12. `ARD WhatsApp Incoming Stats .html` -> `fact_incoming_interactions` (channel = `ARD WhatsApp`)
13. `UPH Incoming Stats .html` -> `fact_incoming_interactions` (channel = `UPH Incoming`)
14. `UPH WhatsApp Incoming Stats .html` -> `fact_incoming_interactions` (channel = `UPH WhatsApp`)
15. `Sales Sheet.html` -> `fact_sales_conversions`
16. `Al Raheem Total.html` -> `fact_period_summaries`

## Data Quality Findings To Handle
- Header variance:
  - `Dialed` vs `Dialed (NEW)`.
  - `Meeting push` vs `Meeting Push`.
  - `Meeting Push(Previous)` vs `Meeting Push (Previous)`.
  - `Querry` typo appears in incoming files.
- Date variance:
  - ISO (`2026-03-26`), slash format (`23/1/26`), and date ranges (`11/02/2026 - 11/03/2026`).
- Non-data rows:
  - Day markers like `S U N D A Y` in `ARD Sales Support   UPH.html`.
  - Summary rows like `Total` and `68 TOTAL LEADS`.
- Numeric cleanup:
  - commas in values (`20,000`, `5,000`), percentages stored as text.
- Sparse rows:
  - many rows with only date and no metrics must be skipped.

## Target Schema (additive)
Use dedicated stats tables (do not overload `leads`):
- `dim_agents(id, name unique)`
- `dim_teams(id, name unique)`
- `dim_projects(id, name unique)`
- `dim_channels(id, name unique)`
- `fact_agent_daily_stats`
- `fact_team_daily_stats`
- `fact_project_daily_stats`
- `fact_incoming_interactions`
- `fact_sales_conversions`
- `fact_weekly_snapshots`
- `fact_period_summaries`
- `etl_import_batches`
- `stg_raw_stats_rows`

## Load Strategy
1. **Stage raw first**
   - Parse each HTML into rows exactly as-is.
   - Insert into `stg_raw_stats_rows` with: `file_name`, `sheet_row_number`, `raw_json`, `import_batch_id`, `raw_hash`.

2. **Normalize columns**
   - Canonical metric names:
     - `total_leads`, `dialed_new`, `dialed_previous`, `connected`, `talk_time_mins`, `hot`, `warm`, `cold`, `not_reachable`, `wrong_number`, `cb_scheduled`, `meetings_done`, `followups_due`, `converted_booked_sold`, `conversion_pct`, `meeting_push`, `meeting_push_previous`, `total_tokens`, `token_received`, `remarks`.
   - Channel fields:
     - `interaction_date`, `interaction_time`, `phone_number`, `person_name`, `query_nature`, `client_query`, `action_steps`, `follow_up_required`.

3. **Load dimensions**
   - Upsert `dim_agents`, `dim_teams`, `dim_projects`, `dim_channels` from transformed rows.

4. **Load fact tables**
   - Use upserts with deterministic natural keys:
     - Agent daily key: `(agent_id, stat_date, shift)`
     - Team daily key: `(team_id, stat_date)`
     - Project daily key: `(project_id, stat_date)`
     - Incoming interaction key: `(channel_id, interaction_date, interaction_time, normalized_phone, coalesce(person_name,''))`
     - Sales conversion key: `(client_name, sale_date, closer)`
     - Weekly snapshot key: `(week_start_date, week_end_date, stat_date)`
     - Period summary key: `(name, period_start_date, period_end_date)`

5. **Validation checks**
   - Per-file loaded row count vs expected non-empty transformed rows.
   - Null rate checks on required fields (date, source dimension).
   - Numeric cast failure log count.
   - Duplicate key collision report.

6. **Publish and reconcile**
   - Compare aggregate totals with source weekly/total sheets.
   - Keep import metadata in `etl_import_batches` for rerun traceability.

## Suggested Execution Plan
1. Build parser script: `scripts/parse-ard-stats-html.mjs`
2. Build migration SQL for new dims/facts/staging tables.
3. Run dry-run parse and generate per-file profiling report JSON.
4. Run staging load (`stg_raw_stats_rows`).
5. Run transform load into dims/facts.
6. Run validation report and reconcile mismatches.
7. Mark batch success in `etl_import_batches`.

## Rollback Plan
- Every run uses a new `import_batch_id`.
- If validation fails, delete by `import_batch_id` from facts and staging only.
- Keep previous successful batch untouched.

## Notes for Current Database
Current CRM entities (`leads`, `lead_sources`, `lead_agents`, `lead_followups`, `lead_events`) should remain as-is.
Stats ingestion should be separate analytics schema/tables to avoid polluting operational lead records.
