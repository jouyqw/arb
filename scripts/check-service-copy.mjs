// This narrow guard flags promotional labels for editorial review; it is not a policy certification.
export function assertServiceCopy(item) {
  const labels = [item.title, item.metaTitle, item.h1, item.category, ...(item.keywords || [])].filter(Boolean);
  const risky = /상위\s*노출|상위\s*등록|상단\s*고정|지식[인iI]\s*(마케팅|대행)|랭킹\s*(상승|올리기)|[1일]위\s*(보장|확정)/;
  if (labels.some(text => risky.test(text))) throw new Error('홍보 문구 수동 검토 필요: ' + (item.slug || item.title));
}
