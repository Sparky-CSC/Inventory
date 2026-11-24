// Replacements for the Base44 "Core" integrations the pages import.

import { uploadFile } from '@/api/files';

/** `const { file_url } = await UploadFile({ file })` */
export const UploadFile = uploadFile;

export default { UploadFile };
