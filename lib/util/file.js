import fs from 'fs-extra';

/**
 * Returns the content for the given file URI
 *
 * @param URI of the file to get the content for
 */
export async function getFileContent(URI) {
  const path = URI.replace('share://', '/share/');
  return await fs.readFile(path, 'utf8');
}