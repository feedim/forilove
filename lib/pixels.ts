declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
  }
}

const EVENT_MAP: Record<string, { fb: string; tt: string }> = {
  CompleteRegistration: { fb: 'CompleteRegistration', tt: 'CompleteRegistration' },
  InitiateCheckout:     { fb: 'InitiateCheckout',     tt: 'InitiateCheckout' },
  Purchase:             { fb: 'Purchase',              tt: 'CompletePayment' },
  PlaceAnOrder:         { fb: 'Purchase',              tt: 'PlaceAnOrder' },
  ViewContent:          { fb: 'ViewContent',           tt: 'ViewContent' },
  Subscribe:            { fb: 'Subscribe',             tt: 'Subscribe' },
  AddToCart:            { fb: 'AddToCart',              tt: 'AddToCart' },
  AddToWishlist:        { fb: 'AddToWishlist',         tt: 'AddToCart' },
  Lead:                 { fb: 'Lead',                  tt: 'SubmitForm' },
};

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  const mapping = EVENT_MAP[eventName];
  if (!mapping) return;
  try { window.fbq?.('track', mapping.fb, params); } catch {}
  try { window.ttq?.track(mapping.tt, params); } catch {}
}
