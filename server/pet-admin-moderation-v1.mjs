// P24 candidate; activating public creation still requires explicit approval of this version.
// English entries in upstream were selected and classified from Shutterstock and contributors'
// LDNOOBW English list (CC BY 4.0), pinned to the revision below. Other entries and patterns
// were authored for Cloudtemple P24; no third-party Vietnamese dataset was imported.
export const wordlistSources = Object.freeze({
  upstream: 'https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/blob/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/en',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  local: 'Cloudtemple P24, independently curated English and Vietnamese entries and contact patterns'
});

const upstream = {
  abuse: ['asshole', 'arsehole', 'bastard', 'bitch', 'bullshit', 'fuck'],
  sexual: ['blowjob', 'bestiality', 'camgirl', 'bukkake']
};
const local = {
  abuse: ['đồ ngu', 'địt mẹ', 'đụ má', 'đéo mẹ', 'mẹ kiếp', 'thằng khốn', 'đồ khốn',
    'đồ mất dạy', 'cút mẹ đi', 'óc chó', 'fuck off', 'piece of shit', 'dumbass', 'go fuck yourself'],
  sexual: ['phim sex', 'phim khiêu dâm', 'clip nóng', 'ảnh khỏa thân', 'chat sex', 'gái gọi',
    'mại dâm', 'bán dâm', 'dịch vụ tình dục', 'porn video', 'watch porn', 'nude pics', 'adult cam', 'sex chat', 'escort service'],
  advertising: ['buy now', 'order now', 'limited time offer', 'click here', 'affiliate link',
    'promo code', 'dm to order', 'earn money fast', 'mua ngay', 'đặt hàng ngay', 'chốt đơn',
    'bấm vào link', 'nhấp vào liên kết', 'mã giảm giá', 'nhắn tin để mua', 'nhận hoa hồng', 'kiếm tiền nhanh'],
  impersonation: ['official admin', 'official moderator', 'verified support agent', 'official chua may support',
    'i am the administrator', 'quản trị viên chính thức', 'hỗ trợ chính thức chùa mây',
    'tôi là quản trị viên', 'đại diện chính thức chùa mây', 'nhân viên hỗ trợ chính thức'],
  hate: ['white power', 'white supremacy', 'heil hitler', 'racial cleansing', 'death to all jews',
    'kill all muslims', 'đuổi hết người hoa', 'tiêu diệt người do thái', 'giết hết người hồi giáo',
    'thanh lọc sắc tộc', 'diệt chủng người khmer'],
  contact: ['add me on telegram', 'message me on whatsapp', 'contact me on zalo',
    'gọi cho tôi qua', 'kết bạn zalo', 'liên hệ qua telegram', 'nhắn qua whatsapp']
};
export const candidateRules = Object.freeze({
  version: 'p24-vi-en-v1',
  entries: Object.freeze(Object.fromEntries(Object.entries(local).map(([category, words]) =>
    [category, Object.freeze([...(upstream[category] ?? []), ...words])])))
});

const fold = text => text.normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu, '').toLowerCase().replace(/đ/g, 'd');
const leet = {a: '[a4@]', e: '[e3€]', i: '[i1!|]', l: '[l1|]', o: '[o0]', s: '[s5$]', t: '[t7+]', b: '[b8]', g: '[g69]'};
const entries = Object.entries(candidateRules.entries).map(([category, words]) => [category, words.map(word =>
  new RegExp('(?<![\\p{L}\\p{N}])' + [...fold(word).replaceAll(' ', '')]
    .map(char => leet[char] ?? char).join('[^\\p{L}\\p{N}]*') + '(?![\\p{L}\\p{N}])', 'u')
)]);
const contact = [
  /\b(?:https?\s*:\s*\/\s*\/|www\s*\.)/u,
  /(?:^|[^\p{L}\p{N}])[\p{L}\p{N}._%+-]+\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\))\s*[\p{L}\p{N}-]+(?:\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\))\s*[\p{L}]{2,})(?![\p{L}\p{N}])/u,
  /(?:^|[^\p{L}\p{N}])(?:[\p{L}\p{N}-]+\s*\.\s*)+(?:com|net|org|io|vn|me|info|link|app|co|uk|xyz|dev|online)(?![\p{L}\p{N}])/u,
  /(?<![\p{L}\p{N}])(?:\+[1-9](?:[ .()-]*\d){7,14}|0[ .()-]*[235789](?:[ .()-]*\d){8,9})(?![ .()-]*\d|[\p{L}\p{N}])/u,
  /(?:^|\s)@[\p{L}\p{N}_]{3,32}(?![\p{L}\p{N}_])/u
];

export function contactMatch(text) {
  const folded = fold(text);
  return contact.some(pattern => pattern.test(folded));
}

export function checkCandidate({name, epitaph, locale}) {
  const raw = [name, epitaph];
  const folded = raw.map(fold);
  const category = entries.find(([, patterns]) =>
    patterns.some(pattern => folded.some(value => pattern.test(value))))?.[0] ??
    (raw.some(contactMatch) ? 'contact' : null);
  return category ? {category, hint: locale === 'en' ? 'Please revise the name or memorial text.' :
    'Vui lòng sửa tên hoặc lời tưởng niệm.'} : null;
}
