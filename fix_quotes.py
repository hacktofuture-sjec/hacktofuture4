path = 'frontend/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace backslash-escaped quotes that are invalid in JSX
fixed = content.replace('\\"', '"')

with open(path, 'w', encoding='utf-8') as f:
    f.write(fixed)

print(f"Fixed. Original length: {len(content)}, Fixed length: {len(fixed)}")
