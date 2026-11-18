export function claimItems(data) {
  return Array.isArray(data?.items)
    ? data.items.filter(item => typeof item?.id === 'string' && typeof item?.claimToken === 'string')
    : [];
}
