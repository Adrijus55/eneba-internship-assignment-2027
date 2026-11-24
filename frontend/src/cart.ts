export const cartKey = 'eneba-cart-offer-ids';

export function loadCart(): number[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(cartKey) ?? '[]');
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
  } catch {
    return [];
  }
}
