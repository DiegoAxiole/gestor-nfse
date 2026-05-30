export function formatCnpj(value: string, lgpd?: boolean): string {
  const clean = value.replace(/\D/g, "");
  if (clean.length !== 14) return value;
  if (lgpd) return `**.${clean.slice(2, 5)}.${clean.slice(5, 8)}/****-${clean.slice(12)}`;
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function maskRazao(value: string): string {
  if (!value) return value;
  const parts = value.trim().split(/\s+/);
  if (parts.length <= 1) return value;
  return parts[0] + " *****";
}

export function maskNome(value: string): string {
  if (!value) return value;
  const parts = value.trim().split(/\s+/);
  if (parts.length <= 1) return value;
  return parts[0] + " *****";
}

export function maskChave(value: string): string {
  if (!value || value.length <= 6) return value;
  return "*".repeat(value.length - 4) + value.slice(-4);
}

export function maskEmail(value: string): string {
  if (!value || !value.includes("@")) return value;
  const [local, domain] = value.split("@");
  if (local.length <= 1) return `*@${domain}`;
  return local[0] + "*****@" + domain;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return isoString;
  }
}

export function generateUUID(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function calculateRemainingDays(validadeFim: string): number {
  try {
    const end = new Date(validadeFim);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? 0 : diffDays;
  } catch {
    return 0;
  }
}


