from pathlib import Path

text = Path("frontend/src/app/admin/pages/payroll/payroll-page.component.html").read_text(encoding="utf-8")
print("count Ã", text.count("Ã"))
print("count …", text.count("…"))
print("count —", text.count("—"))
print("count ·", text.count("·"))
# show a few contexts
idx = 0
shown = 0
while shown < 8:
    i = text.find("Ã", idx)
    if i < 0:
        break
    print(repr(text[max(0, i - 20) : i + 20]))
    idx = i + 1
    shown += 1
