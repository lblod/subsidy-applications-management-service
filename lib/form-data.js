import { APP_URI, FORM_DATA_DIR } from '../env';
import { getFiles, FileData } from './util/file';
import { query } from './util/database';

export async function syncFormData() {
  const files = await getFiles(FORM_DATA_DIR).map(file => new FileData(FileData.pathToUri(file)));
  for (let file of files) {
    console.log(`Starting to process ${file.filename}`);
    if(file.format === 'text/turtle') {
      await file.sync();
    } else {
     console.log(`${file.filename} was ignored as it did not contain text/turtle`);
    }
  }
  return await getActiveFormDataURI();
}

// TODO make this gen a proper JSON response object.
export async function getActiveFormDataURI() {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?subject WHERE {
  ?subject a nfo:FileDataObject ;
           dct:publisher <${APP_URI}> ;
           dct:created ?created .
} 
ORDER BY DESC (?created) LIMIT 1
  `);
  if (response.results.bindings.length) {
    console.log(response.results.bindings);
    return response.results.bindings[0].subject.value;
  }
}