import { describe, expect, it } from 'vitest';
import { cdnObjectUrl, isWebUrl, resourceUrlError } from './resourceUrl.js';

describe('isWebUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(isWebUrl('https://cdn.example.net/episode-resources/1-a.pdf')).toBe(true);
    expect(isWebUrl('http://example.com/x')).toBe(true);
  });
  it('rejects local paths and non-web schemes', () => {
    expect(isWebUrl('file:///C:/Users/DELL/Downloads/Invoice-AMWAPMNM-0001.pdf')).toBe(false);
    expect(isWebUrl('C:\\Users\\DELL\\Downloads\\a.pdf')).toBe(false);
    expect(isWebUrl('/episode-resources/a.pdf')).toBe(false);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('')).toBe(false);
    expect(isWebUrl(null)).toBe(false);
  });
});

describe('resourceUrlError', () => {
  it('rejects a file:// fileUrl with an actionable message', () => {
    expect(resourceUrlError({ fileUrl: 'file:///C:/Users/DELL/Downloads/a.pdf' })).toMatch(/fileUrl must be an http\(s\) link/);
  });
  it('allows a valid fileUrl and an empty previewUrl', () => {
    expect(resourceUrlError({ fileUrl: 'https://cdn.example.net/a.pdf', previewUrl: '' })).toBeNull();
    expect(resourceUrlError({ fileUrl: 'https://cdn.example.net/a.pdf', previewUrl: null })).toBeNull();
  });
  it('rejects a local previewUrl', () => {
    expect(resourceUrlError({ fileUrl: 'https://cdn.example.net/a.pdf', previewUrl: 'file:///x.png' })).toMatch(/previewUrl/);
  });
  it('only checks fields present (partial update)', () => {
    expect(resourceUrlError({ title: 'Renamed' })).toBeNull();
    expect(resourceUrlError({ fileUrl: 'file:///x.pdf' })).not.toBeNull();
  });
});

describe('cdnObjectUrl', () => {
  it('keeps plain keys unchanged and normalises the base', () => {
    expect(cdnObjectUrl('tamil-cdn.b-cdn.net', 'episode-resources/123-guide.pdf')).toBe('https://tamil-cdn.b-cdn.net/episode-resources/123-guide.pdf');
    expect(cdnObjectUrl('https://tamil-cdn.b-cdn.net/', 'a/b.pdf')).toBe('https://tamil-cdn.b-cdn.net/a/b.pdf');
  });
  it('encodes spaces, #, ? and % in the filename but keeps the path separators', () => {
    expect(cdnObjectUrl('cdn.x', 'episode-resources/1-My File #2 (v?) 100%.pdf'))
      .toBe('https://cdn.x/episode-resources/1-My%20File%20%232%20(v%3F)%20100%25.pdf');
  });
});
