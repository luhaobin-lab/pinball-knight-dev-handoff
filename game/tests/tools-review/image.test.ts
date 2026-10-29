import { describe, expect, it } from 'vitest';
import { createImage, cropImage, decodePng, encodePng, parseRect, rectText, type RgbaImage } from '../../tools/lib/image.ts';

const bytes = (base64: string): Uint8Array => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const rgba = (image: RgbaImage): number[][] => Array.from({ length: image.width * image.height }, (_, i) => Array.from(image.data.subarray(i * 4, i * 4 + 4)));

// 3x2 images written by Pillow in colour types the screenshots never use
const PALETTE_4BIT_TRNS = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACBAMAAABvWnspAAAAMFBMVEUKFB7IZDIA/wD///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqftocAAAAAnRSTlP/AOW3MEoAAAAOSURBVHicY2SUZzL8AAAB5QFF+0T+5QAAAABJRU5ErkJggg==';
const GREY = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAAAAAC4HznGAAAAEElEQVR4nGNkcHBgOPCfHQAHFQJI3WyeewAAAABJRU5ErkJggg==';
const GREY_ALPHA = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAQAAAA3fa6RAAAAFklEQVR4nGNg+O/Q0MDAcOD/f0Z2dgAl0QUNUcsFPgAAAABJRU5ErkJggg==';
const GREY_16BIT = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACEAAAAADoj+WFAAAAFklEQVR4nGNgYGBk+P+fQcikgYGJEQAUfQLJR3YMBQAAAABJRU5ErkJggg==';
const ONE_BIT = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACAQAAAAC1D1u3AAAADElEQVR4nGNwYDgAAAGEAQEKf5BQAAAAAElFTkSuQmCC';

describe('PNG codec', () => {
  it('round-trips an opaque image (written as RGB) and a translucent one (RGBA)', async () => {
    const image = createImage(7, 5);
    for (let i = 0; i < image.data.length; i++) image.data[i] = (i * 37 + 11) & 255;
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    const opaque = await encodePng(image);
    expect(opaque[25]).toBe(2);
    expect(await decodePng(opaque)).toEqual(image);
    image.data[3] = 128;
    const translucent = await encodePng(image);
    expect(translucent[25]).toBe(6);
    expect(await decodePng(translucent)).toEqual(image);
  });

  it('decodes a 4-bit palette image with tRNS', async () => {
    const image = await decodePng(bytes(PALETTE_4BIT_TRNS));
    expect([image.width, image.height]).toEqual([3, 2]);
    const [a, b, c, d] = [[10, 20, 30, 255], [200, 100, 50, 0], [0, 255, 0, 255], [255, 255, 255, 255]];
    expect(rgba(image)).toEqual([a, b, c, d, c, b]);
  });

  it('decodes grey, grey + alpha, 16-bit grey (high byte) and 1-bit images', async () => {
    const grey = (values: number[], alpha: number[] = values.map(() => 255)): number[][] => values.map((v, i) => [v, v, v, alpha[i]]);
    expect(rgba(await decodePng(bytes(GREY)))).toEqual(grey([0, 64, 128, 192, 255, 7]));
    expect(rgba(await decodePng(bytes(GREY_ALPHA)))).toEqual(grey([0, 64, 128, 192, 255, 7], [255, 128, 0, 255, 1, 7]));
    expect(rgba(await decodePng(bytes(GREY_16BIT)))).toEqual(grey([0, 1, 255, 18, 128, 2]));
    expect(rgba(await decodePng(bytes(ONE_BIT)))).toEqual(grey([0, 255, 0, 255, 255, 0]));
  });

  it('rejects data that is not a PNG', async () => {
    await expect(decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).rejects.toThrow('not a PNG');
  });
});

describe('rectangles', () => {
  it('parses x0,y0,x1,y1 and rejects empty or malformed ones', () => {
    expect(parseRect('549,96,1749,966')).toEqual({ x0: 549, y0: 96, x1: 1749, y1: 966 });
    expect(rectText(parseRect(' 0, 0, 2, 2 '))).toBe('0,0,2,2');
    for (const bad of ['1,2,3', '0,0,0,5', '5,5,1,9', '0,0,1.5,2', 'a,b,c,d', '-1,0,4,4']) expect(() => parseRect(bad)).toThrow();
  });

  it('crops exactly and refuses crops outside the image', () => {
    const image = createImage(4, 3);
    for (let i = 0; i < 12; i++) image.data[i * 4] = i;
    const part = cropImage(image, { x0: 1, y0: 1, x1: 3, y1: 3 });
    expect([part.width, part.height]).toEqual([2, 2]);
    expect(Array.from({ length: 4 }, (_, i) => part.data[i * 4])).toEqual([5, 6, 9, 10]);
    expect(() => cropImage(image, { x0: 0, y0: 0, x1: 5, y1: 3 })).toThrow('exceeds');
  });
});
