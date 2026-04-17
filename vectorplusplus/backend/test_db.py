from database.db import get_supabase
sb = get_supabase()
outcomes = sb.table("fix_outcomes").select("*").execute()
print(f"Fix Outcomes: {len(outcomes.data)}")
for o in outcomes.data:
    print(f"ID: {o['id']}, outcome: {o['outcome']}, cluster_id: {o['cluster_id']}")

prs = sb.table("pull_requests").select("*").execute()
print(f"\nPull Requests: {len(prs.data)}")
for pr in prs.data:
    print(f"ID: {pr['id']}, status: {pr['status']}, cluster_id: {pr['cluster_id']}")
