import fs from 'fs-extra';
import { resolve } from 'path';

/**
 * JS file containing all helpers for working with files
 */


export async function getFiles(dir) {
  const dirents = await fs.readdir(dir, {withFileTypes: true});
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

export function uriToPath(uri) {
  return uri.replace('data://', '/data/').replace('config://', '/config/');
}

export function uriToFilename(uri) {
  return uri.replace('data://', '/data/').replace('config://', '/config/');
}

export function filenameToUri(uri) {
  return uri.replace('/data/', 'data://').replace('/config/', 'config://');
}