from github import Github
import os
from dotenv import load_dotenv
load_dotenv()
g = Github(os.getenv("GITHUB_TOKEN"))
repo = g.get_repo("facebook/react")
tree = repo.get_git_tree(repo.default_branch, recursive=True)
paths = [t.path for t in tree.tree if t.type == 'blob' and not t.path.startswith("fixtures/") and not t.path.startswith("docs/")]
print("\n".join(paths[:20]))
print(f"Total files: {len(paths)}")
