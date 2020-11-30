import fs from 'fs-extra';
import { resolve } from 'path';

/**
 * all helpers for working with files
 */

/**
 * Returns the content for the given file URI
 *
 * @param uri of the file to get the content for
 */
export async function getFileContent(uri) {
  const path = uri.replace('share://', '/share/');
  return await fs.readFile(path, 'utf8');
}

export async function getFiles(dir) {
  const dirents = await fs.readdir(dir, {withFileTypes: true});
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}