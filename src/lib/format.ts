export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const shortDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
