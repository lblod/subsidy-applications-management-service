import fs from 'fs-extra';

/**
 * Returns the content for the given file URI
 *
 * @param uri of the file to get the content for
 */
export async function getFileContent(uri) {
  const path = uri.replace('share://', '/share/');
  return await fs.readFile(path, 'utf8');
}