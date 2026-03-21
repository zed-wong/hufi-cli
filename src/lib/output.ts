export function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export function printText(message: string) {
  console.log(message);
}

export function printError(message: string) {
  console.error(message);
}

export function maskSecret(value: string): string {
  if (!value) return value;
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
