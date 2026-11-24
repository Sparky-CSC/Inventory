// Applies a theme object ({ primary: '#0D6EFD', base100: '#FFFFFF', … }) to the
// page by setting CSS variables. Each colour is written twice — as given, and
// as "R G B" numbers that Tailwind needs for transparent variants.

const CSS_VARIABLES = {
  primary: '--primary',
  primaryFocus: '--primary-focus',
  primaryContent: '--primary-content',
  secondary: '--secondary',
  secondaryFocus: '--secondary-focus',
  secondaryContent: '--secondary-content',
  base100: '--base-100',
  base200: '--base-200',
  base300: '--base-300',
  baseContent: '--base-content',
  baseContentSecondary: '--base-content-secondary',
  info: '--info',
  success: '--success',
  warning: '--warning',
  error: '--error',
};

export function hexToRgbChannels(hex) {
  if (typeof hex !== 'string') return null;
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const number = parseInt(value, 16);
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

export function applyTheme(theme, root = document.documentElement) {
  if (!theme) return;
  Object.entries(theme).forEach(([key, value]) => {
    const variable = CSS_VARIABLES[key];
    if (!variable || !value) return;
    root.style.setProperty(variable, value);
    const channels = hexToRgbChannels(value);
    if (channels) root.style.setProperty(`${variable}-rgb`, channels);
  });
}
