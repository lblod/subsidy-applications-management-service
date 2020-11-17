import {getFileContent} from './util/file';
import { ACTIVE_FORM_URI } from '../env';


export async function getFormData(){
  return await getFileContent(ACTIVE_FORM_URI);
}