import { getFileContent } from './util/file';
import { ACTIVE_FORM_URI } from '../env';

/**
 * Returns the form-data in `text/turtle` format for the given URI.
 *
 * @param uri - the **turtle file** containing the form-data in `text/turtle` format. Defaults to {@link ACTIVE_FORM_URI}
 *
 * @returns {Promise<string>} `text/turtle`
 */
export async function getFormData(uri = ACTIVE_FORM_URI) {
  return await getFileContent(uri);
}