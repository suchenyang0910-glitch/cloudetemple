import io
import json
import sys
from pathlib import Path
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT = "BeVietnamPro"
PAGE = landscape(A5)
INK = HexColor("#3f342d")
MUTED = HexColor("#796b60")
PAPER = HexColor("#f4efe4")
ACCENT = HexColor("#8a4938")
LINE = HexColor("#cbbfaf")
MEMORIAL_BG = HexColor("#f1dfcf")
WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

def text(c, value, x, y, size, color=INK, align="left", bold=False):
    value = str(value)
    if bold:
        width = pdfmetrics.stringWidth(value, FONT, size)
        origin = {"left": x, "center": x - width / 2, "right": x - width}[align]
        c.saveState()
        c.setFillColor(color)
        c.setStrokeColor(color)
        c.setLineWidth(.28)
        line = c.beginText(origin, y)
        line.setFont(FONT, size)
        line.setTextRenderMode(2)
        line.textLine(value)
        c.drawText(line)
        c.restoreState()
        return
    c.setFont(FONT, size)
    c.setFillColor(color)
    fn = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
    fn(x, y, value)

def fit(value, limit, size):
    value = str(value)
    if pdfmetrics.stringWidth(value, FONT, size) <= limit:
        return value
    while value and pdfmetrics.stringWidth(value + "…", FONT, size) > limit:
        value = value[:-1]
    return value.rstrip() + "…"

def wrap(value, limit, size, max_lines=2):
    words = str(value).split()
    lines = []
    for word in words:
        candidate = f'{lines[-1]} {word}' if lines else word
        if lines and pdfmetrics.stringWidth(candidate, FONT, size) <= limit:
            lines[-1] = candidate
        elif len(lines) < max_lines:
            lines.append(word)
        else:
            lines[-1] = fit(f'{lines[-1]} {word}', limit, size)
    return lines

def background(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE[0], PAGE[1], fill=1, stroke=0)

def paper_wash(c, width, height, alpha=.68):
    c.saveState()
    c.setFillColor(PAPER)
    c.setFillAlpha(alpha)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    for index in range(10):
        c.setFillAlpha(alpha * ((10 - index) / 10) ** 2)
        c.rect(width + index * 2.7 * mm, 0, 2.9 * mm, height, fill=1, stroke=0)
    c.restoreState()

def incense_icon(c, x, y):
    c.saveState()
    c.setStrokeColor(ACCENT)
    c.setFillColor(ACCENT)
    c.setLineWidth(.55)
    c.ellipse(x, y, x + 3.8 * mm, y + 1.35 * mm, fill=1, stroke=0)
    c.line(x + .6 * mm, y + .7 * mm, x + 1.1 * mm, y - .8 * mm)
    c.line(x + 3.2 * mm, y + .7 * mm, x + 2.7 * mm, y - .8 * mm)
    c.line(x + 1.9 * mm, y + 1.1 * mm, x + 1.9 * mm, y + 3.1 * mm)
    smoke = c.beginPath()
    smoke.moveTo(x + 1.9 * mm, y + 3.1 * mm)
    smoke.curveTo(x + 1.2 * mm, y + 3.8 * mm, x + 2.7 * mm, y + 4.4 * mm, x + 1.9 * mm, y + 5.2 * mm)
    c.drawPath(smoke, fill=0, stroke=1)
    c.restoreState()

def cover(c, model, asset):
    w, h = PAGE
    c.drawImage(ImageReader(asset), 0, 0, width=w, height=h, preserveAspectRatio=False, mask="auto")
    paper_wash(c, 82 * mm, h, .67)
    center = 49 * mm
    text(c, model["familyName"], center, h * .64, 22, INK, "center", True)
    text(c, "LỊCH NGÀY GIỖ", center, h * .51, 11, ACCENT, "center", True)
    text(c, model["yearName"], center, h * .42, 11, INK, "center")
    text(c, model["year"], center, h * .31, 22, INK, "center", True)
    text(c, model["note"], 8 * mm, 8 * mm, 6, MUTED)
    c.showPage()

def month_page(c, model, month, asset):
    background(c)
    w, h = PAGE
    image_h = 52 * mm
    image_y = h - image_h
    c.drawImage(ImageReader(asset), 0, image_y, width=w, height=image_h, preserveAspectRatio=False, mask="auto")
    paper_wash(c, 72 * mm, image_h, .61)
    c.saveState()
    c.setFillColor(Color(.96, .93, .86, alpha=.69))
    c.roundRect(w - 62 * mm, h - 17 * mm, 54 * mm, 9.5 * mm, 2 * mm, fill=1, stroke=0)
    c.restoreState()
    left, right, bottom = 8 * mm, 8 * mm, 7 * mm
    month_word = month["name"].removeprefix("Tháng ")
    text(c, "Tháng", left, h - 12 * mm, 16, INK)
    month_x = left + pdfmetrics.stringWidth("Tháng ", FONT, 16)
    text(c, month_word, month_x, h - 12 * mm, 16, INK)
    year_x = month_x + pdfmetrics.stringWidth(month_word + " ", FONT, 16)
    text(c, model["year"], year_x, h - 12 * mm, 16, INK)
    text(c, model["yearName"], left, h - 19 * mm, 8.5, ACCENT, bold=True)
    text(c, model["familyName"], w - 35 * mm, h - 12.7 * mm, 7.5, MUTED, "center")
    grid_top = h - 58 * mm
    grid_h = grid_top - bottom
    rows = len(month["cells"]) // 7
    col_w, row_h = (w - left - right) / 7, grid_h / rows
    for col, day in enumerate(WEEKDAYS):
        text(c, day, left + col_w * (col + .5), grid_top + 2.7 * mm, 7.5, ACCENT if col == 6 else MUTED, "center", col == 6)
    for index, cell in enumerate(month["cells"]):
        if not cell or not any(event["kind"] == "memorial" for event in cell["events"]):
            continue
        row, col = divmod(index, 7)
        x, y = left + col * col_w, grid_top - row * row_h
        c.setFillColor(MEMORIAL_BG)
        c.rect(x, y - row_h, col_w, row_h, fill=1, stroke=0)
    c.setStrokeColor(LINE); c.setLineWidth(.45)
    for row in range(rows + 1):
        y = grid_top - row * row_h
        c.line(left, y, w - right, y)
    for col in range(8):
        x = left + col * col_w
        c.line(x, grid_top, x, bottom)
    for index, cell in enumerate(month["cells"]):
        if not cell: continue
        row, col = divmod(index, 7)
        x, y = left + col * col_w, grid_top - row * row_h
        text(c, cell["solarDay"], x + 1.5 * mm, y - 4.2 * mm, 9.5, ACCENT if col == 6 else INK, bold=col == 6)
        text(c, cell["lunar"], x + col_w - 1.3 * mm, y - 4.0 * mm, 8.1, MUTED, "right")
        event_y = y - 7.6 * mm
        if any(event["kind"] == "memorial" for event in cell["events"]):
            incense_icon(c, x + col_w - 5.3 * mm, y - row_h + 2.1 * mm)
        for event in cell["events"]:
            label = event["label"]
            memorial = event["kind"] == "memorial"
            size = 8.6 if memorial else 8.0
            if memorial:
                for line in wrap(label, col_w - 2.8 * mm, size):
                    text(c, line, x + 1.4 * mm, event_y, size, ACCENT, bold=True)
                    event_y -= 2.8 * mm
            else:
                for line in wrap(label, col_w - 2.8 * mm, size):
                    text(c, line, x + 1.4 * mm, event_y, size, MUTED)
                    event_y -= 2.8 * mm
    text(c, model["note"], left, 3.4 * mm, 5.2, MUTED)
    text(c, month["number"], w - right, 4.5 * mm, 5, MUTED, "right")
    c.showPage()

def main():
    if len(sys.argv) != 3:
        raise SystemExit("font and calendar asset paths required")
    pdfmetrics.registerFont(TTFont(FONT, sys.argv[1]))
    assets = Path(sys.argv[2]).resolve()
    model = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=PAGE, pageCompression=1)
    c.setTitle(f'{model["familyName"]} · Lịch ngày giỗ {model["year"]}')
    c.setAuthor("Chùa Mây")
    c.setSubject("Lịch gia đình tạo riêng trên máy chủ Chùa Mây")
    cover(c, model, assets / "cover.jpg")
    for month in model["months"]:
        month_page(c, model, month, assets / f'month-{month["number"]:02d}.jpg')
    c.save()
    sys.stdout.buffer.write(stream.getvalue())

if __name__ == "__main__":
    main()
