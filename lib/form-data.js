import { APP_URI, FORM_DATA_DIR } from '../env';
import { getFiles } from './util/file';
import { query } from './util/database';
import { TurtleFile } from './turtle-file';

const FORM_FILE_TYPE = 'http://data.lblod.gift/concepts/form-data-file-type';

export async function syncFormFiles() {
  const filesOnDisk = await getFormFilesOnDisk();
  const filesInDB = await getFormFilesInDB();

  // NOTE: filter out the new form-files dropped on-disk (by the user)
  const newbies = filesOnDisk.filter(i => !filesInDB.find(j => j.uri === i.uri));

  // NOTE: filter out the form-files saved in the DB but which have disappeared on-disk (could be breaking for the frontend)
  const lost = filesInDB.filter(i => !filesOnDisk.find(j => j.uri === i.uri));

  if (newbies.length) {
    console.log(`${newbies.length} new form-files found:`);
    newbies.forEach(file => console.log(`- ${file.filename}`));
    for (let file of newbies) {
      try {
        await file.sync();
      } catch (e) {
        console.log(`${file.filename} was ignored, reason:`);
        console.log(e);
      }
    }
  }

  if(lost.length){
    console.warn('form-files where lost!');
    console.warn('All forms that have been filed with the following form-files can not be rendered anymore:');
    lost.forEach(file => console.warn(`- ${file.uri}`));
  }

  return await getActiveFormFile();
}

async function getFormFilesOnDisk() {
  return (await getFiles(FORM_DATA_DIR))
  .map(filepath => new TurtleFile({filepath, type: FORM_FILE_TYPE}))
  .sort((a, b) => a.created - b.created);
}

async function getFormFilesInDB() {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?subject WHERE {
  ?subject a nfo:FileDataObject, <${FORM_FILE_TYPE}> ;
           dct:publisher <${APP_URI}> .
}`);
    const bindings = response.results.bindings;
    return bindings.map(binding => new TurtleFile({uri: binding.subject.value, type: FORM_FILE_TYPE})).sort((a, b) => a.created - b.created);
}

export async function getActiveFormFile() {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?subject WHERE {
  ?subject a nfo:FileDataObject, <${FORM_FILE_TYPE}> ;
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
    message: `Could not find an active form-data file, are you sure to have created form-files in ${FORM_DATA_DIR}`,
  };
}