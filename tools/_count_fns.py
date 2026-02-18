import re

with open('script.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

count = 0
fns = []
pattern = re.compile(r'^\s+(async\s+)?function\s+(\w+)')

for i in range(22441, 40569):  # 0-indexed: lines 22442 to 40569
    m = pattern.match(lines[i])
    if m:
        count += 1
        fns.append(f"{i+1}: {m.group().strip()}")

print(f"Total: {count}")
for f in fns:
    print(f)
