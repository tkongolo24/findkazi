"""Bundle the site into one HTML file for publishing as a shareable link.

Run from this folder:  python3 build_artifact.py
Output: dist/digital-job-club.html
"""
import pathlib
import re
from urllib.parse import quote  # favicon data URI

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
icon_svg = (root / "logo/findkazi-icon.svg").read_text(encoding="utf-8").strip()
css = (root / "css/style.css").read_text(encoding="utf-8")
i18n = (root / "js/i18n.js").read_text(encoding="utf-8")
app = (root / "js/app.js").read_text(encoding="utf-8")

body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
# drop the external script tags; the scripts are inlined below
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

hosted_css = """
/* hosted-page adjustments: keep the sticky header clear of phone status bars */
.topbar { top: env(safe-area-inset-top, 0px); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: var(--brand); }
.jump-preview { right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
"""

for name, src in (("i18n.js", i18n), ("app.js", app)):
    assert "</script" not in src.lower(), name

out = f"""<title>FindKazi</title>
<meta name="theme-color" content="#5b2a86">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{quote(icon_svg)}">
<style>
{css}
{hosted_css}
</style>
{body}
<script>window.DJC_HOSTED = true;</script>
<script>
{i18n}
</script>
<script>
{app}
</script>
"""

dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "digital-job-club.html").write_text(out, encoding="utf-8")
print("wrote", dist / "digital-job-club.html", len(out), "bytes")
