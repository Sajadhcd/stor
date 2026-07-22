export function formatIQD(amount: number): string {
  const formatted = Math.floor(amount).toLocaleString('ar-IQ');
  return `${formatted} د.ع`;
}
