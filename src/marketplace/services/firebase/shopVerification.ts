import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  getBlob,
  getMetadata,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { auth, db, storage } from './config';

export type ShopPhotoKind = 'exterior' | 'interior' | 'shopkeeper';
export type BusinessDocumentType =
  | 'gumasta'
  | 'udyam'
  | 'gst_certificate'
  | 'other';
export type ShopApplicationStatus =
  | 'draft'
  | 'pending_verification'
  | 'additional_information_required'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface ShopVerificationFiles {
  exterior: File;
  interior: File;
  shopkeeper: File;
  businessDocument: File;
  businessDocumentType: BusinessDocumentType;
  additionalDocuments?: { file: File; type: BusinessDocumentType }[];
}

export interface ShopVerificationFileReference {
  path: string;
  name: string;
  contentType: string;
  size: number;
  sha256: string;
}

export interface ShopVerificationUploadProgress {
  file: string;
  percent: number;
}

export const SHOP_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const BUSINESS_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = [...PHOTO_TYPES, 'application/pdf'];

export function getShopVerificationCompletenessError(
  files: Partial<ShopVerificationFiles>
): string | null {
  const photoCount = [files.exterior, files.interior, files.shopkeeper].filter(Boolean).length;
  if (photoCount < 3) return 'Upload 3 shop photographs to continue.';
  if (!files.businessDocument || !files.businessDocumentType) {
    return 'Upload at least 1 business document to continue.';
  }
  return null;
}

export function validateUploadFile(
  file: File,
  allowedTypes: string[],
  maxBytes: number
): string | null {
  if (!file.size) return 'The selected file is empty.';
  if (!allowedTypes.includes(file.type)) return 'Choose a supported JPEG, PNG, WebP, or PDF file.';
  if (file.size > maxBytes) {
    return `This file is too large. The maximum size is ${Math.floor(maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}

async function sha256(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot securely validate uploaded files. Use a supported, up-to-date browser.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hasValidFileSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  switch (file.type) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/webp': {
      const hasImageSignature = file.type === 'image/jpeg'
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : file.type === 'image/png'
          ? bytes.length >= 8 &&
            bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
            bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
          : bytes.length >= 12 &&
            String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
      if (!hasImageSignature) return false;
      if (typeof createImageBitmap !== 'function') return true;
      try {
        const image = await createImageBitmap(file);
        image.close();
        return true;
      } catch {
        return false;
      }
    }
    case 'application/pdf':
      if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return false;
      const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 2048)).arrayBuffer());
      return String.fromCharCode(...tail).includes('%%EOF');
    default:
      return false;
  }
}

export async function validateShopVerificationFiles(
  files: ShopVerificationFiles
): Promise<void> {
  const photoFiles = [files.exterior, files.interior, files.shopkeeper];
  for (const photo of photoFiles) {
    const error = validateUploadFile(photo, PHOTO_TYPES, SHOP_PHOTO_MAX_BYTES);
    if (error) throw new Error(error);
    if (!(await hasValidFileSignature(photo))) throw new Error(`${photo.name} is not a valid image file.`);
  }
  const documentError = validateUploadFile(
    files.businessDocument,
    DOCUMENT_TYPES,
    BUSINESS_DOCUMENT_MAX_BYTES
  );
  if (documentError) throw new Error(documentError);
  if (!(await hasValidFileSignature(files.businessDocument))) {
    throw new Error(`${files.businessDocument.name} is not a valid PDF or image file.`);
  }
  if (!['gumasta', 'udyam', 'gst_certificate', 'other'].includes(files.businessDocumentType)) {
    throw new Error('Select a valid business document type.');
  }
  for (const document of files.additionalDocuments || []) {
    const error = validateUploadFile(
      document.file,
      DOCUMENT_TYPES,
      BUSINESS_DOCUMENT_MAX_BYTES
    );
    if (error) throw new Error(error);
    if (!(await hasValidFileSignature(document.file))) {
      throw new Error(`${document.file.name} is not a valid PDF or image file.`);
    }
    if (!['gumasta', 'udyam', 'gst_certificate', 'other'].includes(document.type)) {
      throw new Error('Select a valid additional business document type.');
    }
  }
  const digests = await Promise.all(photoFiles.map(sha256));
  if (new Set(digests).size !== photoFiles.length) {
    throw new Error('Upload three different shop photographs; the same file cannot fill multiple photo requirements.');
  }
}

function uploadFile(
  path: string,
  file: File,
  digest: string,
  onProgress: (percent: number) => void
): Promise<void> {
  if (!storage) return Promise.reject(new Error('Firebase Storage is not available.'));
  return new Promise((resolve, reject) => {
    const fileRef = ref(storage, path);
    void getMetadata(fileRef).then((metadata) => {
      if (metadata.customMetadata?.sha256 !== digest ||
          metadata.size !== file.size ||
          metadata.contentType !== file.type) {
        throw new Error('An immutable verification file already exists with different metadata. Select another file.');
      }
      onProgress(100);
      resolve();
    }).catch((error: unknown) => {
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
      if (errorCode !== 'storage/object-not-found') {
        reject(error);
        return;
      }
      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
        customMetadata: { sha256: digest },
      });
      task.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          onProgress(snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0);
        },
        reject,
        () => resolve()
      );
    });
  });
}

export async function submitShopVerificationApplication(
  shopId: string,
  ownerUid: string,
  files: ShopVerificationFiles,
  onProgress: (progress: ShopVerificationUploadProgress) => void
): Promise<void> {
  if (!shopId || !ownerUid || auth.currentUser?.uid !== ownerUid) {
    throw new Error('Sign in to the applicant account before submitting shop verification documents.');
  }
  await validateShopVerificationFiles(files);

  const shopRef = doc(db, 'shops', shopId);
  const applicationRef = doc(db, 'shops', shopId, 'private', 'verificationApplication');
  const [shopSnapshot, applicationSnapshot] = await Promise.all([
    getDoc(shopRef),
    getDoc(applicationRef),
  ]);
  if (!shopSnapshot.exists() || shopSnapshot.data().ownerId !== ownerUid) {
    throw new Error('The authenticated applicant is not the owner of this shop.');
  }
  const currentApplication = applicationSnapshot.exists() ? applicationSnapshot.data() : null;
  if (currentApplication &&
      currentApplication.status !== 'additional_information_required') {
    throw new Error('This application is already submitted or has a final status.');
  }

  const photos = [
    ['exterior', files.exterior],
    ['interior', files.interior],
    ['shopkeeper', files.shopkeeper],
  ] as const;
  const photoReferences: Record<ShopPhotoKind, ShopVerificationFileReference> = {
    exterior: { path: '', name: '', contentType: '', size: 0, sha256: '' },
    interior: { path: '', name: '', contentType: '', size: 0, sha256: '' },
    shopkeeper: { path: '', name: '', contentType: '', size: 0, sha256: '' },
  };
  const digests = await Promise.all(photos.map(([, file]) => sha256(file)));
  const uploadJobs = photos.map(async ([kind, file], index) => {
    const path = `shop-verification/${ownerUid}/${shopId}/photos/${kind}-${digests[index]}`;
    await uploadFile(path, file, digests[index], (percent) => {
      onProgress({ file: kind, percent });
    });
    photoReferences[kind] = {
      path,
      name: file.name,
      contentType: file.type,
      size: file.size,
      sha256: digests[index],
    };
  });
  const documentDigest = await sha256(files.businessDocument);
  const documentPath = `shop-verification/${ownerUid}/${shopId}/documents/business-${documentDigest}`;
  uploadJobs.push((async () => {
    await uploadFile(documentPath, files.businessDocument, documentDigest, (percent) => {
      onProgress({ file: 'business document', percent });
    });
  })());
  const additionalDocumentReferences: (ShopVerificationFileReference & {
    type: BusinessDocumentType;
  })[] = [];
  for (const [index, additional] of (files.additionalDocuments || []).entries()) {
    const digest = await sha256(additional.file);
    const path = `shop-verification/${ownerUid}/${shopId}/documents/additional-${index + 1}-${digest}`;
    uploadJobs.push((async () => {
      await uploadFile(path, additional.file, digest, (percent) => {
        onProgress({ file: additional.file.name, percent });
      });
      additionalDocumentReferences[index] = {
        path,
        name: additional.file.name,
        contentType: additional.file.type,
        size: additional.file.size,
        sha256: digest,
        type: additional.type,
      };
    })());
  }
  await Promise.all(uploadJobs);

  const shop = shopSnapshot.data();
  const submittedAt = new Date().toISOString();
  const application = {
    applicantUid: ownerUid,
    shopId,
    shopName: String(shop.name || ''),
    applicantName: String(shop.ownerName || ''),
    applicantEmail: String(shop.email || ''),
    applicantPhone: String(shop.phone || ''),
    address: shop.address || {},
    photos: photoReferences,
    businessDocument: {
      ...{
        path: documentPath,
        name: files.businessDocument.name,
        contentType: files.businessDocument.type,
        size: files.businessDocument.size,
        sha256: documentDigest,
      },
      type: files.businessDocumentType,
    },
    ...(additionalDocumentReferences.length ? { additionalDocuments: additionalDocumentReferences } : {}),
    status: 'pending_verification' as const,
    submittedAt,
  };
  await setDoc(applicationRef, application, { merge: true });
}

export async function readPrivateVerificationFile(path: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage is not available.');
  const blob = await getBlob(ref(storage, path));
  return URL.createObjectURL(blob);
}
