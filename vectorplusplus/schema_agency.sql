-- Agency Pipeline Schema

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  phone text,
  address text,
  google_rating float,
  review_count int,
  website_url text,
  has_poor_presence boolean default false,
  created_at timestamp default now()
);

create table if not exists contact_status (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  status text default 'Uncontacted', -- Uncontacted | Contacted | Interested | Converted | Rejected
  preview_site_url text,
  updated_at timestamp default now()
);

create table if not exists opportunity_score (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  score int,
  reasons text
);
