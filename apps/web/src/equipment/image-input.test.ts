import { describe, expect, it } from 'vitest';
import { validateImageHeader, MAX_IMAGE_BYTES } from './image-input';
describe('local image validation', () => {
  it('accepts matching PNG/JPEG/WebP signatures', () => {
    expect(() =>
      validateImageHeader(
        'image/png',
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        100,
      ),
    ).not.toThrow();
    expect(() =>
      validateImageHeader('image/jpeg', new Uint8Array([255, 216, 255]), 100),
    ).not.toThrow();
    expect(() =>
      validateImageHeader(
        'image/webp',
        new TextEncoder().encode('RIFF0000WEBP'),
        100,
      ),
    ).not.toThrow();
  });
  it('rejects spoofed MIME and unsupported files', () => {
    expect(() =>
      validateImageHeader('image/png', new Uint8Array([255, 216, 255]), 100),
    ).toThrow();
    expect(() =>
      validateImageHeader('image/svg+xml', new Uint8Array([1, 2]), 100),
    ).toThrow();
  });
  it('rejects empty or oversized files before decoding', () => {
    expect(() =>
      validateImageHeader('image/png', new Uint8Array(), 0),
    ).toThrow();
    expect(() =>
      validateImageHeader('image/png', new Uint8Array(), MAX_IMAGE_BYTES + 1),
    ).toThrow();
  });
});
