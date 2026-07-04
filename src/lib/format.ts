// Money is stored as a whole integer in platform_settings.currency (e.g. 300 = NT$300).
// `minorUnits` is a DISPLAY concept (how many decimals to show), NOT Stripe's exponent.
export function formatMoney(amount: number, currency = "TWD", minorUnits = 0): string {
  const value =
    minorUnits > 0
      ? (amount / Math.pow(10, minorUnits)).toFixed(minorUnits)
      : Math.round(amount).toLocaleString();
  return `${value} ${currency.toUpperCase()}`;
}
