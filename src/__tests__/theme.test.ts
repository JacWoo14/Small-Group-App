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

  it('falls back to the default theme for Object.prototype property names (regression guard)', () => {
    // resolveThemeId previously used the `in` operator, which checks the
    // prototype chain — 'constructor'/'toString'/'hasOwnProperty' would all
    // incorrectly resolve as "valid" theme ids and break THEMES[id].primary.
    expect(resolveThemeId('constructor')).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId('toString')).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId('hasOwnProperty')).toBe(DEFAULT_THEME_ID);
  });
});
