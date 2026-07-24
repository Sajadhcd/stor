import { apiFetch } from './api';

const storeId = process.env.NEXT_PUBLIC_STORE_ID || '11111111-1111-4111-8111-111111111111';

export async function getOrCreateCartId(): Promise<string> {
  if (typeof window === 'undefined') return '';

  const cartId = localStorage.getItem('nexio_cart_id');
  if (cartId) return cartId;

  try {
    const res = await apiFetch('/carts', {
      method: 'POST',
      body: JSON.stringify({
        storeId,
        currency: 'IQD',
      }),
    });
    if (res && res.id) {
      localStorage.setItem('nexio_cart_id', res.id);
      return res.id;
    }
  } catch (err) {
    console.error('Failed to create backend cart:', err);
  }
  return '';
}

export async function syncCartFromBackend(): Promise<any[]> {
  if (typeof window === 'undefined') return [];

  const cartId = localStorage.getItem('nexio_cart_id');
  if (!cartId) return [];

  try {
    const cartData = await apiFetch(`/carts/${cartId}`);
    if (cartData && cartData.items) {
      const mappedItems = cartData.items.map((item: any) => {
        const product = item.variant?.product;
        const title = product?.titleTranslations?.ar || product?.titleTranslations?.en || 'منتج متميز';
        const variantTitle = item.variant?.attributes
          ? `${title} (${Object.values(item.variant.attributes).join(' - ')})`
          : title;
        const price = Number(item.variant?.priceOverride || item.variant?.price || 75000);
        return {
          id: product?.id || item.variant?.productId,
          title: variantTitle,
          price,
          variantId: item.variantId,
          quantity: item.quantity,
        };
      });
      localStorage.setItem('nexio_cart', JSON.stringify(mappedItems));
      window.dispatchEvent(new Event('storage'));
      return mappedItems;
    }
  } catch (err) {
    console.error('Failed to sync cart from backend:', err);
  }

  // Fallback to local storage if API call fails
  const localCart = localStorage.getItem('nexio_cart');
  return localCart ? JSON.parse(localCart) : [];
}

export async function addCartItem(
  variantId: string,
  quantity: number,
  title: string,
  price: number,
  productId: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Update Local Cart Immediately (Optimistic UI Update)
  const saved = localStorage.getItem('nexio_cart');
  const cart = saved ? JSON.parse(saved) : [];
  const existingIndex = cart.findIndex((item: any) => item.variantId === variantId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      id: productId,
      title,
      price,
      variantId,
      quantity,
    });
  }
  localStorage.setItem('nexio_cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('storage'));

  // 2. Sync to Backend
  try {
    const cartId = await getOrCreateCartId();
    if (cartId) {
      await apiFetch(`/carts/${cartId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          variantId,
          quantity,
        }),
      });
      await syncCartFromBackend();
    }
  } catch (err) {
    console.error('Failed to sync add item to backend:', err);
  }
}

export async function updateCartItemQty(variantId: string, quantity: number): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Update Local Cart Immediately
  const saved = localStorage.getItem('nexio_cart');
  if (saved) {
    const cart = JSON.parse(saved);
    const updated = cart.map((item: any) =>
      item.variantId === variantId ? { ...item, quantity } : item
    );
    localStorage.setItem('nexio_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  }

  // 2. Sync to Backend
  try {
    const cartId = localStorage.getItem('nexio_cart_id');
    if (cartId) {
      const cartData = await apiFetch(`/carts/${cartId}`);
      const item = cartData.items?.find((i: any) => i.variantId === variantId);
      if (item) {
        await apiFetch(`/carts/${cartId}/items/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
      } else {
        // If not on backend, add it
        await apiFetch(`/carts/${cartId}/items`, {
          method: 'POST',
          body: JSON.stringify({ variantId, quantity }),
        });
      }
      await syncCartFromBackend();
    }
  } catch (err) {
    console.error('Failed to sync update quantity to backend:', err);
  }
}

export async function removeCartItem(variantId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Update Local Cart Immediately
  const saved = localStorage.getItem('nexio_cart');
  if (saved) {
    const cart = JSON.parse(saved);
    const updated = cart.filter((item: any) => item.variantId !== variantId);
    localStorage.setItem('nexio_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  }

  // 2. Sync to Backend
  try {
    const cartId = localStorage.getItem('nexio_cart_id');
    if (cartId) {
      const cartData = await apiFetch(`/carts/${cartId}`);
      const item = cartData.items?.find((i: any) => i.variantId === variantId);
      if (item) {
        await apiFetch(`/carts/${cartId}/items/${item.id}`, {
          method: 'DELETE',
        });
      }
      await syncCartFromBackend();
    }
  } catch (err) {
    console.error('Failed to sync delete item to backend:', err);
  }
}

export async function clearCartBackend(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Clear Local Cart Immediately
  localStorage.removeItem('nexio_cart');
  window.dispatchEvent(new Event('storage'));

  // 2. Sync to Backend
  try {
    const cartId = localStorage.getItem('nexio_cart_id');
    if (cartId) {
      await apiFetch(`/carts/${cartId}/clear`, {
        method: 'DELETE',
      });
      localStorage.removeItem('nexio_cart_id');
    }
  } catch (err) {
    console.error('Failed to clear cart on backend:', err);
  }
}
