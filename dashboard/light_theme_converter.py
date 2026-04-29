import re
import sys

def convert_to_light(content):
    replacements = [
        (r'bg-slate-950/(\d+)', lambda m: f'bg-white/{m.group(1)}'),
        (r'bg-slate-950', r'bg-white/80'),
        (r'bg-slate-900', r'bg-white/90'),
        (r'bg-slate-800', r'bg-white/60'),
        (r'bg-white/5', r'bg-white/80'),
        (r'bg-white/10', r'bg-white/90'),
        (r'border-white/10', r'border-slate-200/50'),
        (r'border-white/20', r'border-slate-300'),
        (r'text-white', r'text-slate-900'),
        (r'text-slate-100', r'text-slate-800'),
        (r'text-slate-200', r'text-slate-700'),
        (r'text-slate-300', r'text-slate-600'),
        (r'text-sky-100', r'text-sky-700'),
        (r'text-sky-200', r'text-sky-600'),
        (r'text-cyan-200', r'text-cyan-700'),
        (r'text-emerald-200', r'text-emerald-700'),
        (r'shadow-\[0_16px_45px_rgba\(2,6,23,0\.45\)\]', r'shadow-[0_16px_45px_rgba(148,163,184,0.15)]'),
        (r'shadow-\[0_24px_70px_rgba\(2,6,23,0\.55\)\]', r'shadow-[0_24px_70px_rgba(148,163,184,0.25)]'),
        (r'shadow-\[0_18px_45px_rgba\(2,6,23,0\.35\)\]', r'shadow-[0_18px_45px_rgba(148,163,184,0.15)]'),
        (r"'https://demotiles\.maplibre\.org/style\.json'", r"'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'")
    ]
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    return content

for file_path in sys.argv[1:]:
    with open(file_path, 'r') as f:
        content = f.read()
    new_content = convert_to_light(content)
    with open(file_path, 'w') as f:
        f.write(new_content)
