import io
import json
import sys
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A5, landscape
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
WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

def text(c, value, x, y, size, color=INK, align="left"):
    c.setFont(FONT, size)
    c.setFillColor(color)
    fn = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
    fn(x, y, str(value))

def fit(value, limit):
    value = str(value)
    if pdfmetrics.stringWidth(value, FONT, 5.2) <= limit:
        return value
    while value and pdfmetrics.stringWidth(value + "…", FONT, 5.2) > limit:
        value = value[:-1]
    return value.rstrip() + "…"

def background(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE[0], PAGE[1], fill=1, stroke=0)

def cover(c, model):
    background(c)
    w, h = PAGE
    c.saveState()
    c.setFillColor(Color(.22, .25, .21, alpha=.10))
    c.circle(w * .78, h * .65, 35 * mm, fill=1, stroke=0)
    c.setFillColor(Color(.20, .22, .19, alpha=.18))
    p = c.beginPath(); p.moveTo(0, 22 * mm); p.curveTo(45 * mm, 58 * mm, 80 * mm, 20 * mm, 122 * mm, 48 * mm); p.lineTo(w, 0); p.lineTo(0, 0); p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.setStrokeColor(Color(.29, .24, .20, alpha=.48)); c.setLineWidth(1.2)
    c.line(19 * mm, h - 20 * mm, 58 * mm, h - 35 * mm)
    for dx, dy in ((0,0),(9,-3),(18,-6),(27,-10)):
        c.circle((20+dx) * mm, (h/mm-20+dy) * mm, 1.8 * mm, fill=0, stroke=1)
    c.restoreState()
    text(c, model["familyName"], w / 2, h * .58, 24, INK, "center")
    text(c, "LỊCH NGÀY GIỖ", w / 2, h * .46, 11, ACCENT, "center")
    text(c, model["year"], w / 2, h * .34, 22, INK, "center")
    text(c, model["note"], w / 2, 10 * mm, 5.8, MUTED, "center")
    c.showPage()

def month_page(c, model, month):
    background(c)
    w, h = PAGE
    left, right, top, bottom = 10 * mm, 10 * mm, 20 * mm, 11 * mm
    month_word = month["name"].removeprefix("Tháng ")
    text(c, "Tháng", left, h - 11 * mm, 16, INK)
    month_x = left + pdfmetrics.stringWidth("Tháng ", FONT, 16)
    text(c, month_word, month_x, h - 11 * mm, 16, INK)
    year_x = month_x + pdfmetrics.stringWidth(month_word + " ", FONT, 16)
    text(c, model["year"], year_x, h - 11 * mm, 16, INK)
    text(c, model["familyName"], w - right, h - 10.5 * mm, 7, MUTED, "right")
    grid_top = h - top - 7 * mm
    grid_h = grid_top - bottom
    rows = len(month["cells"]) // 7
    col_w, row_h = (w - left - right) / 7, grid_h / rows
    for col, day in enumerate(WEEKDAYS):
        text(c, day, left + col_w * (col + .5), grid_top + 2.6 * mm, 6.2, ACCENT if col == 6 else MUTED, "center")
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
        text(c, cell["solarDay"], x + 1.8 * mm, y - 4.7 * mm, 8, ACCENT if col == 6 else INK)
        text(c, cell["lunar"], x + col_w - 1.5 * mm, y - 4.2 * mm, 5.1, MUTED, "right")
        event_y = y - 8.2 * mm
        for event in cell["events"]:
            color = ACCENT if event.startswith("Giỗ ") else MUTED
            text(c, fit(event, col_w - 3 * mm), x + 1.6 * mm, event_y, 5.2, color)
            event_y -= 3.2 * mm
    text(c, model["note"], left, 4.5 * mm, 4.8, MUTED)
    text(c, month["number"], w - right, 4.5 * mm, 5, MUTED, "right")
    c.showPage()

def main():
    if len(sys.argv) != 2:
        raise SystemExit("font path required")
    pdfmetrics.registerFont(TTFont(FONT, sys.argv[1]))
    model = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=PAGE, pageCompression=1)
    c.setTitle(f'{model["familyName"]} · Lịch ngày giỗ {model["year"]}')
    c.setAuthor("Chùa Mây")
    c.setSubject("Lịch gia đình tạo riêng trên máy chủ Chùa Mây")
    cover(c, model)
    for month in model["months"]:
        month_page(c, model, month)
    c.save()
    sys.stdout.buffer.write(stream.getvalue())

if __name__ == "__main__":
    main()
