import { basename } from 'path';

const hasUtf8DecodedAsLatin1 = (value: string) => /(?:Ã|Â)[\u0080-\u00bf]/.test(value);

export const normalizeUploadFileName = (value: string) => {
  const safeBaseName = basename(value);

  if (!hasUtf8DecodedAsLatin1(safeBaseName)) {
    return safeBaseName.normalize('NFC');
  }

  const decoded = Buffer.from(safeBaseName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? safeBaseName.normalize('NFC') : decoded.normalize('NFC');
};
