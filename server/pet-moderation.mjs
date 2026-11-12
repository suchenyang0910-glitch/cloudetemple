// Local starter rules for P18 verification. Public creation requires a separately approved rule set.
export const draftRules = Object.freeze({
  version: 'p18-draft-1',
  entries: Object.freeze({
    abuse: Object.freeze(['fuck', 'đồ ngu', 'địt mẹ']),
    advertising: Object.freeze(['buy now', 'mua ngay', 'https', 'www']),
    impersonation: Object.freeze(['official admin', 'quản trị viên chính thức'])
  })
});

function normalize(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd')
    .replace(/[\p{Cf}\p{Cc}]/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function moderatePublicText({name, epitaph, locale}, rules = draftRules) {
  const texts = [name, epitaph].map(value => ' ' + normalize(value) + ' ');
  for (const [category, entries] of Object.entries(rules.entries)) {
    if (entries.some(entry => texts.some(value => value.includes(' ' + normalize(entry) + ' ')))) {
      return {category, hint: locale === 'en' ? 'Please revise the name or memorial text.' : 'Vui lòng sửa tên hoặc lời tưởng niệm.'};
    }
  }
  return null;
}
