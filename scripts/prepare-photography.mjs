import {fileURLToPath} from 'node:url';
import {preparePhotoPreviews} from '../local/photo-previews.mjs';
const index=await preparePhotoPreviews(fileURLToPath(new URL('../',import.meta.url)));
console.log('Prepared photography previews:',Object.keys(index.photos).length);
