import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DOCUMENT_MAX_BYTES,
  SHOP_PHOTO_MAX_BYTES,
  getShopVerificationCompletenessError,
  validateShopVerificationFiles,
  validateUploadFile,
  type ShopVerificationFiles,
} from './shopVerification';

function file(name: string, type: string, bytes: number[]): File {
  return Object.assign(
    new Blob([Uint8Array.from(bytes)], { type }),
    { name, lastModified: 0 }
  ) as File;
}

const jpeg = (end: number) => [0xff, 0xd8, 0xff, 0x01, end];
const validFiles = (): ShopVerificationFiles => ({
  exterior: file('exterior.jpg', 'image/jpeg', jpeg(1)),
  interior: file('interior.jpg', 'image/jpeg', jpeg(2)),
  shopkeeper: file('shopkeeper.jpg', 'image/jpeg', jpeg(3)),
  businessDocument: file('business.pdf', 'application/pdf', [
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46,
  ]),
  businessDocumentType: 'gumasta',
});

describe('shop verification upload validation', () => {
  it('blocks applications with no photographs or only two photographs', () => {
    const files = validFiles();
    expect(getShopVerificationCompletenessError({})).toBe('Upload 3 shop photographs to continue.');
    expect(getShopVerificationCompletenessError({
      exterior: files.exterior,
      interior: files.interior,
      businessDocument: files.businessDocument,
      businessDocumentType: files.businessDocumentType,
    })).toBe('Upload 3 shop photographs to continue.');
    expect(getShopVerificationCompletenessError({
      exterior: files.exterior,
      interior: files.interior,
      shopkeeper: files.shopkeeper,
    })).toBe('Upload at least 1 business document to continue.');
    expect(getShopVerificationCompletenessError(files)).toBeNull();
  });

  it('rejects empty, unsupported, and oversized files', () => {
    expect(validateUploadFile(file('empty.png', 'image/png', []), ['image/png'], SHOP_PHOTO_MAX_BYTES))
      .toContain('empty');
    expect(validateUploadFile(file('photo.gif', 'image/gif', [1]), ['image/png'], SHOP_PHOTO_MAX_BYTES))
      .toContain('supported');
    const oversizedPhoto = Object.assign(
      new Blob([new Uint8Array(SHOP_PHOTO_MAX_BYTES + 1)], { type: 'image/png' }),
      { name: 'large.png' }
    ) as File;
    expect(validateUploadFile(oversizedPhoto, ['image/png'], SHOP_PHOTO_MAX_BYTES))
      .toContain('too large');
    const oversizedDocument = Object.assign(
      new Blob([new Uint8Array(BUSINESS_DOCUMENT_MAX_BYTES + 1)], { type: 'application/pdf' }),
      { name: 'large.pdf' }
    ) as File;
    expect(validateUploadFile(oversizedDocument, ['application/pdf'], BUSINESS_DOCUMENT_MAX_BYTES))
      .toContain('too large');
  });

  it('accepts three distinct supported shop photos and a business document', async () => {
    await expect(validateShopVerificationFiles(validFiles())).resolves.toBeUndefined();
  });

  it('rejects one photo reused for multiple required photo roles', async () => {
    const files = validFiles();
    files.interior = file('same.jpg', 'image/jpeg', jpeg(1));
    files.exterior = file('same-copy.jpg', 'image/jpeg', jpeg(1));
    await expect(validateShopVerificationFiles(files)).rejects.toThrow('three different');
  });

  it('rejects unsupported or corrupted file content even when the extension is plausible', async () => {
    const files = validFiles();
    files.interior = file('corrupt.jpg', 'image/jpeg', [0, 1, 2, 3]);
    await expect(validateShopVerificationFiles(files)).rejects.toThrow('valid image');
  });
});
