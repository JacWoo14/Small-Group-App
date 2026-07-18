import { resolveThemeId, DEFAULT_THEME_ID } from '../constants/theme';

describe('resolveThemeId', () => {
  it('falls back to the default theme for null', () => {
    expect(resolveThemeId(null)).toBe(DEFAULT_THEME_ID);
  });

  it('falls back to the default theme for undefined', () => {
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME_ID);
  });

  it('falls back to the default theme for an empty string', () => {
    expect(resolveThemeId('')).toBe(DEFAULT_THEME_ID);
  });

  it('falls back to the default theme for an unknown value', () => {
    expect(resolveThemeId('cerulean')).toBe(DEFAULT_THEME_ID);
  });

  it('passes through each valid theme id unchanged', () => {
    expect(resolveThemeId('sage')).toBe('sage');
    expect(resolveThemeId('navy')).toBe('navy');
    expect(resolveThemeId('burgundy')).toBe('burgundy');
    expect(resolveThemeId('slate')).toBe('slate');
  });
});
