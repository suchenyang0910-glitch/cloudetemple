// Greeting card generation 鈥?doc: 06-mvp-mechanics.md 搂4鈥?

// Card spec: 9:16, 1080脳1920 canonical, scaled to 540脳960 for prototype
const W = 540, H = 960;

const FLOWERS = [
  { key: 'hoa-mai', label: 'Hoa Mai 姊呰姳', emoji: '馃尲', color: '#f5c842' },
  { key: 'hoa-dao', label: 'Hoa 膼脿o 妗冭姳', emoji: '馃尭', color: '#f5a0c0' },
];

const GREETINGS = [
  { key: 'a', vi: 'Ch煤c m峄玭g n膬m m峄沬!\nCh煤c gia 膽矛nh b矛nh an, h岷h ph煤c.', cn: '鎭鏂版槬\n闃栧骞冲畨锛屽悏绁ュ鎰? },
  { key: 'b', vi: 'N膬m m峄沬, v岷 s峄?nh瓢 媒!\nS峄ヽ kho岷? may m岷痭, th峄媙h v瓢峄g.', cn: '鏂板勾涓囦簨濡傛剰\n鍋ュ悍骞冲畨锛岀姘旀弧婊? },
];

// Draw the card onto a canvas element and return it
export function buildCard({ flower, greetingKey, customText, temple, period }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const flowerData = FLOWERS.find(f => f.key === flower) ?? FLOWERS[0];
  const greetingData = GREETINGS.find(g => g.key === greetingKey);
  const greetingText = customText || (greetingData?.vi ?? GREETINGS[0].vi);

  // 鈹€鈹€ Background: scene placeholder (colour gradient) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const SCENE_COLORS = {
    day:   ['#c8a060', '#d4885a'],
    dusk:  ['#b06040', '#805030'],
    night: ['#304050', '#202838'],
    dawn:  ['#d0a870', '#b08858'],
  };
  const [c1, c2] = SCENE_COLORS[period] ?? SCENE_COLORS.day;
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  bgGrad.addColorStop(0, c1);
  bgGrad.addColorStop(1, c2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Temple silhouette placeholder (simple arch shape)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(W * 0.1, H * 0.62);
  ctx.lineTo(W * 0.1, H * 0.35);
  ctx.quadraticCurveTo(W * 0.5, H * 0.1, W * 0.9, H * 0.35);
  ctx.lineTo(W * 0.9, H * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 鈹€鈹€ Flower illustration (emoji centred) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  ctx.save();
  ctx.font = `${W * 0.22}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 20;
  ctx.fillText(flowerData.emoji, W / 2, H * 0.42);
  ctx.restore();

  // 鈹€鈹€ Bottom text panel 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const panelTop = H * 0.65;
  const panelH   = H - panelTop;
  ctx.save();
  const panelGrad = ctx.createLinearGradient(0, panelTop, 0, H);
  panelGrad.addColorStop(0, 'rgba(250,245,235,0.97)');
  panelGrad.addColorStop(1, 'rgba(245,238,220,1)');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, panelTop, W, panelH);
  ctx.restore();

  // Temple name
  ctx.save();
  ctx.font = `600 ${W * 0.038}px -apple-system, sans-serif`;
  ctx.fillStyle = '#8b5e1a';
  ctx.textAlign = 'center';
  ctx.fillText('Ch霉a Di L岷穋 路 寮ュ嫆瀵?, W / 2, panelTop + 44);
  ctx.restore();

  // Divider
  ctx.save();
  ctx.strokeStyle = '#d6b880';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, panelTop + 62);
  ctx.lineTo(W * 0.8, panelTop + 62);
  ctx.stroke();
  ctx.restore();

  // Greeting text (multiline)
  ctx.save();
  ctx.font = `${W * 0.042}px -apple-system, sans-serif`;
  ctx.fillStyle = '#2a2318';
  ctx.textAlign = 'center';
  const lines = greetingText.split('\n');
  const lineH = W * 0.058;
  const textTop = panelTop + 100;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, textTop + i * lineH));
  ctx.restore();

  // Footer disclaimer 鈥?HARD-RENDERED, cannot be hidden via CSS (doc: 08 搂4.3)
  ctx.save();
  ctx.font = `${W * 0.022}px -apple-system, sans-serif`;
  ctx.fillStyle = '#9a8060';
  ctx.textAlign = 'center';
  ctx.fillText('L峄漣 ch煤c l脿 t芒m 媒 路 绁濇効鏄績鎰?, W / 2, H - 44);
  ctx.restore();

  return canvas;
}

export function getFlowers() { return FLOWERS; }
export function getGreetings() { return GREETINGS; }

// Share the card 鈥?Web Share API with file, download fallback
export async function shareCard(canvas, templeId) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('toBlob failed')); return; }
      const file = new File([blob], `chua-may-${templeId}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: 'Ch霉a Di L岷穋 路 寮ュ嫆瀵? });
          resolve({ method: 'share' });
        } catch (e) {
          if (e.name === 'AbortError') resolve({ method: 'aborted' });
          else reject(e);
        }
      } else {
        // Download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chua-may-${templeId}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        resolve({ method: 'download' });
      }
    }, 'image/png');
  });
}

