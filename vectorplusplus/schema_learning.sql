-- Vector++ Learning Layer Migration
-- Run this in your Supabase SQL Editor AFTER schema.sql

-- Track outcomes of every auto-generated PR so the system can learn over time
create table if not exists fix_outcomes (
  id uuid primary key default gen_random_uuid(),
  cluster_id int references clusters(id) on delete set null,
  pr_url text,
  branch_name text,

  -- Outcome recorded when PR is merged/closed
  outcome text,            -- 'merged' | 'rejected' | 'pending'
  outcome_recorded_at timestamp,

  -- What the fix was about (snapshot from analysis)
  issue_type text,         -- bug | feature_request | performance | ux | security | docs
  severity text,           -- low | medium | high | critical
  affected_area text,
  estimated_complexity text, -- low | medium | high

  -- How many users were notified and how many patches were in the PR
  notified_users_count int default 0,
  patch_count int default 0,

  -- Raw agent outputs stored for future few-shot retrieval
  analysis_snapshot jsonb,
  plan_snapshot jsonb,

  created_at timestamp default now()
);

-- Index so we can quickly fetch successful fixes for a given issue type
create index if not exists fix_outcomes_type_idx
  on fix_outcomes (issue_type, outcome);

-- Index for cluster lookup
create index if not exists fix_outcomes_cluster_idx
  on fix_outcomes (cluster_id);
