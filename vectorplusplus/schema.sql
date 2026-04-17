-- Vector++ Database Schema
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- Raw feedback from all sources
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  source text,           -- 'github' | 'twitter' | 'reddit'
  text text,
  url text unique,
  author text,
  created_at timestamp default now(),
  embedding vector(384), -- sentence-transformers all-MiniLM-L6-v2 dimension
  cluster_id int default null,
  status text default 'raw' -- raw | clustered | processing | done
);

-- Clusters of similar feedback
create table if not exists clusters (
  id serial primary key,
  label text,
  priority_score float,
  feedback_count int,
  created_at timestamp default now(),
  status text default 'pending' -- pending | running | done | failed
);

-- Agent run logs (for dashboard timeline)
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  cluster_id int references clusters(id),
  agent_name text,       -- analyzer | planner | coder | tester
  status text,           -- running | done | failed
  input text,
  output text,
  started_at timestamp default now(),
  finished_at timestamp
);

-- Generated PRs
create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  cluster_id int references clusters(id),
  github_pr_url text,
  branch_name text,
  created_at timestamp default now(),
  status text            -- open | merged | failed
);

-- Add foreign key link from feedback to clusters (after both tables exist)
ALTER TABLE feedback 
  ADD CONSTRAINT fk_feedback_cluster 
  FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- Index for vector similarity search
create index if not exists feedback_embedding_idx 
  on feedback using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
