import fs from 'fs-extra';
import { resolve } from 'path';

/**
 * JS file containing all helpers for working with files
 */

/**
 * Returns all files within a directory, regardless of directory structure.
 *
 * @param dir - root directory
 *
 * @returns {Promise<string[]>}
 */
export async function getFiles(dir) {
  let dirents = await fs.readdir(dir, {withFileTypes: true});
  /**
   * NOTE: filter out hidden files (like: .gitkeep)
   *       {@link https://stackoverflow.com/questions/8905680/nodejs-check-for-hidden-files/20285137#20285137}
   */
  dirents = dirents.filter(dir => !(/(^|\/)\.[^\/\.]/g).test(dir.name));
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

export function uriToFilename(uri) {
  return uri.replace('data://', '/data/').replace('config://', '/config/');
}

export function filenameToUri(uri) {
  return uri.replace('/data/', 'data://').replace('/config/', 'config://');
}