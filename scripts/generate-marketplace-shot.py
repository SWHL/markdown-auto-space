from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "res" / "marketplace-vscode-shot.png"

W, H = 1600, 900


def load_font(size: int, mono: bool = False, bold: bool = False, cjk: bool = False):
    candidates = []
    if mono and cjk:
      candidates = [
          "/System/Library/Fonts/Hiragino Sans GB.ttc",
          "/System/Library/Fonts/STHeiti Medium.ttc",
          "/Library/Fonts/Arial Unicode.ttf",
      ]
    elif mono:
      candidates = [
          "/System/Library/Fonts/Menlo.ttc",
          "/System/Library/Fonts/SFNSMono.ttf",
      ]
    elif cjk and bold:
      candidates = [
          "/System/Library/Fonts/Hiragino Sans GB.ttc",
          "/System/Library/Fonts/STHeiti Medium.ttc",
          "/System/Library/Fonts/Supplemental/Songti.ttc",
      ]
    elif cjk:
      candidates = [
          "/System/Library/Fonts/Hiragino Sans GB.ttc",
          "/System/Library/Fonts/STHeiti Light.ttc",
          "/System/Library/Fonts/Supplemental/Songti.ttc",
          "/Library/Fonts/Arial Unicode.ttf",
      ]
    elif bold:
      candidates = [
          "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
          "/System/Library/Fonts/Supplemental/Arial.ttf",
      ]
    else:
      candidates = [
          "/System/Library/Fonts/Supplemental/Arial.ttf",
      ]

    for path in candidates:
      p = Path(path)
      if p.exists():
        return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


font_title = load_font(34, bold=True, cjk=True)
font_ui = load_font(22)
font_ui_small = load_font(18, cjk=True)
font_ui_cjk = load_font(22, cjk=True)
font_code = load_font(27, mono=True, cjk=True)
font_code_small = load_font(21, mono=True, cjk=True)

img = Image.new("RGBA", (W, H), "#f4efe8")
draw = ImageDraw.Draw(img)

# background glow
draw.ellipse((1180, -80, 1580, 320), fill="#fde7d7")
draw.ellipse((-120, 640, 240, 1000), fill="#dbe7f6")

# window shadow
draw.rounded_rectangle((92, 78, 1510, 838), radius=28, fill="#d6d0c7")
draw.rounded_rectangle((82, 66, 1500, 826), radius=28, fill="#1e1e1e")

# title bar
draw.rounded_rectangle((82, 66, 1500, 118), radius=28, fill="#252526")
draw.rectangle((82, 92, 1500, 118), fill="#252526")
for i, color in enumerate(["#ff5f57", "#febc2e", "#28c840"]):
    x = 112 + i * 26
    draw.ellipse((x, 86, x + 14, 100), fill=color)
draw.text((170, 82), "Markdown Auto Space Demo - Visual Studio Code", fill="#d4d4d4", font=font_ui_small)

# activity bar
draw.rectangle((82, 118, 138, 826), fill="#181818")
for y, color in [(164, "#c586c0"), (234, "#858585"), (304, "#858585"), (374, "#858585")]:
    draw.rounded_rectangle((100, y, 120, y + 20), radius=5, fill=color)

# sidebar
draw.rectangle((138, 118, 420, 826), fill="#252526")
draw.text((166, 148), "EXPLORER", fill="#cccccc", font=font_ui_small)
draw.text((166, 188), "MARKDOWN-AUTO-SPACE", fill="#ffffff", font=font_ui_small)
files = [
    ("README.md", "#9cdcfe"),
    ("docs", "#dcdcaa"),
    ("marketplace-demo.md", "#ffffff"),
    ("package.json", "#ce9178"),
    ("res", "#dcdcaa"),
]
for idx, (name, color) in enumerate(files):
    y = 236 + idx * 42
    if name == "marketplace-demo.md":
        draw.rounded_rectangle((150, y - 8, 404, y + 24), radius=8, fill="#37373d")
    draw.text((172, y), name, fill=color, font=font_ui_cjk)

# editor
draw.rectangle((420, 118, 1500, 826), fill="#1e1e1e")

# tabs
draw.rectangle((420, 118, 1500, 164), fill="#2d2d2d")
draw.rounded_rectangle((446, 126, 700, 162), radius=8, fill="#1e1e1e")
draw.text((468, 134), "marketplace-demo.md", fill="#ffffff", font=font_ui_small)
draw.text((720, 134), "README.md", fill="#969696", font=font_ui_small)

# breadcrumbs
draw.text((452, 182), "docs  >  marketplace-demo.md", fill="#858585", font=font_ui_small)

# title and badges
draw.text((452, 228), "# Markdown Auto Space", fill="#ffffff", font=font_title)
badge_specs = [
    ("Save to Fix", "#3b2a18", "#f59e0b"),
    ("Selection Format", "#1f2850", "#60a5fa"),
    ("Diagnostics", "#183227", "#34d399"),
]
badge_x = 452
for label, bg, fg in badge_specs:
    width = int(draw.textlength(label, font=font_ui_small)) + 34
    draw.rounded_rectangle((badge_x, 282, badge_x + width, 316), radius=17, fill=bg)
    draw.text((badge_x + 17, 290), label, fill=fg, font=font_ui_small)
    badge_x += width + 18

# section labels
draw.text((452, 352), "Before", fill="#dcdcaa", font=font_ui_cjk)
draw.text((962, 352), "After", fill="#9cdcfe", font=font_ui_cjk)

# code panels
draw.rounded_rectangle((452, 390, 930, 632), radius=18, fill="#151515", outline="#5c2b10", width=2)
draw.rounded_rectangle((962, 390, 1440, 632), radius=18, fill="#151515", outline="#264f78", width=2)

before_lines = [
    "- 买了iPhone ，好开心",
    "- 宽带有10Gbps",
    "- 使用`rapidocr`库",
    "- 新MacBook有15 %的CPU提升",
]
after_lines = [
    "- 买了 iPhone，好开心",
    "- 宽带有 10 Gbps",
    "- 使用 `rapidocr` 库",
    "- 新 MacBook 有 15% 的 CPU 提升",
]

def draw_code_block(lines, x, y, underline_rules=False):
    yy = y
    for idx, line in enumerate(lines):
        draw.text((x, yy), line, fill="#d4d4d4", font=font_code)
        if underline_rules:
            if idx == 0:
                draw.line((x + 76, yy + 38, x + 248, yy + 38), fill="#ff8c32", width=4)
            if idx == 1:
                draw.line((x + 98, yy + 38, x + 212, yy + 38), fill="#ff8c32", width=4)
            if idx == 2:
                draw.line((x + 46, yy + 38, x + 200, yy + 38), fill="#ff8c32", width=4)
            if idx == 3:
                draw.line((x + 186, yy + 38, x + 242, yy + 38), fill="#ff8c32", width=4)
        yy += 52

draw_code_block(before_lines, 484, 432, underline_rules=True)
draw_code_block(after_lines, 994, 432, underline_rules=False)

# center arrow
draw.ellipse((922, 478, 972, 528), fill="#f97316")
draw.line((936, 503, 956, 503), fill="#ffffff", width=6)
draw.line((950, 493, 962, 503), fill="#ffffff", width=6)
draw.line((950, 513, 962, 503), fill="#ffffff", width=6)

# diagnostics card
draw.rounded_rectangle((452, 672, 734, 786), radius=18, fill="#252526")
draw.text((478, 700), "Diagnostics", fill="#ffffff", font=font_ui_cjk)
diag_lines = [
    "MAS001  中英文 / 数字之间应有空格",
    "MAS002  中文与行内代码之间应有空格",
    "MAS007  数字与单位之间应有空格",
]
for i, text in enumerate(diag_lines):
    draw.text((478, 734 + i * 22), text, fill="#c8c8c8", font=font_ui_small)

draw.rounded_rectangle((760, 672, 1062, 786), radius=18, fill="#252526")
draw.text((786, 700), "Safe for Markdown", fill="#ffffff", font=font_ui_cjk)
safe_lines = [
    "Protects links, inline code, URL, HTML",
    "Skips fenced code and YAML front matter",
    "Only runs on Markdown documents",
]
for i, text in enumerate(safe_lines):
    draw.text((786, 734 + i * 22), text, fill="#c8c8c8", font=font_ui_small)

draw.rounded_rectangle((1088, 672, 1440, 786), radius=18, fill="#252526")
draw.text((1114, 700), "Search intent covered", fill="#ffffff", font=font_ui_cjk)
search_lines = [
    "markdown chinese spacing",
    "cjk spacing formatter",
    "markdown diagnostics",
]
for i, text in enumerate(search_lines):
    draw.text((1114, 734 + i * 22), text, fill="#c8c8c8", font=font_code_small)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print(OUT)
