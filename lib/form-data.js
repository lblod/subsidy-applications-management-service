import { APP_URI, FORM_DATA_DIR } from '../env';
import { getFiles } from './util/file';
import { query } from './util/database';
import { TurtleFile } from './turtle-file';

export async function syncFormData() {
  const files = (await getFiles(FORM_DATA_DIR)).
      map(filepath => new TurtleFile({filepath})).
      sort((a, b) => a.created - b.created);

  if (files.length) {
    console.log(`${files.length} form-data versions found`);
    files.forEach(file => console.log(`- ${file.name}`));
  }
  for (let file of files) {
    try {
      console.log(`Starting to process ${file.filename}`);
      await file.sync();
    } catch (e) {
      console.log(`${file.filename} was ignored, reason:`);
      console.log(e);
    }
  }
  return await getActiveFormData();
}

export async function getActiveFormData() {
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
    return new TurtleFile({uri: response.results.bindings[0].subject.value});
  }
  throw {
    status: 404,
    message: `Could not find an active form-data file, are you sure to have created form-data files in ${FORM_DATA_DIR}`,
  };
}