import {access, copyFile, mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function setup(root) {
  await mkdir(path.join(root, 'public/assets/media'), {recursive: true});
  for (const name of ['site', 'content', 'journal', 'writing']) {
    const target = path.join(root, 'public', `${name}.json`);
    try {
      await access(target);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await copyFile(
        path.join(root, 'public', `${name}.example.json`),
        target,
        constants.COPYFILE_EXCL,
      );
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await setup(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  console.log('Local content files initialized from the examples.');
}
