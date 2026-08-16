const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function getPrinterWebUrl(ip: string): string {
  const value = ip.trim();

  if (!IPV4_PATTERN.test(value) || value.split('.').some((octet) => Number(octet) > 255)) {
    return '';
  }

  return `http://${value}`;
}
