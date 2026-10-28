import subprocess, pathlib, sys
root = pathlib.Path(__file__).parent
r = subprocess.run(["tsc", "-p", str(root)], capture_output=True, text=True)
if r.returncode != 0:
    print(r.stdout, r.stderr); sys.exit(1)
order = ["core", "sprites", "units", "audio", "battle", "main"]
js = "\n".join((root / "build" / f"{n}.js").read_text() for n in order)
js = "(function(){\n" + js + "\n})();"
html = (root / "index.html").read_text().replace("/*__GAME__*/", js)
(root / "dist").mkdir(exist_ok=True)
(root / "dist" / "sztandary.html").write_text(html)
print("ok", len(html))
