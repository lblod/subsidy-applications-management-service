import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { updateSourceData } from './lib/source-data';
import { ApplicationForm } from './lib/application-form';
import { getFileContent } from './lib/util/file';
import { ACTIVE_FORM_URI } from './env';

// TODO parser
//  look up more in depth on how to use this

app.use(bodyParser.json({
  type: function(req) {
    return /^application\/json/.test(req.get('content-type'));
  },
}));

app.get('/', function(req, res) {
  const message = 'Hey there, you have reached subsidy-applications-management-service! Seems like I\'m doing just fine! :)';
  res.send(message);
});

/**
 * Returns the **active** form-data in `text/turtle` format
 * TODO change this endpoint to just return the URI off the active-form
 */
app.get('/active-form-data', async function(req, res, next) {
  try {
    const ttl = await getFileContent(ACTIVE_FORM_URI);
    return res.status(200).set('content-type', 'text/turtle').send(ttl);
  } catch (e) {
    console.log(`Something went wrong while retrieving the form-data:`);
    console.log(e);
    return next(e);
  }
});

app.get('/application-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    const applicationForm = await new ApplicationForm().init(uuid);
    const source = applicationForm.source;
    const form = await getFileContent(applicationForm.formURI ? applicationForm.formURI : ACTIVE_FORM_URI);
    return res.status(200).set('content-type', 'application/vnd.api+json').send({
      form,
      source,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/vnd.api+json').send({message: e.message});
    }
    console.log(`Something unexpected went wrong while retrieving the application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.put('/application-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  const delta = req.body;

  try {
    await new ApplicationForm().init(uuid); // NOTE check to ensure
    await updateSourceData(delta);
    return res.status(204).send();
  } catch (e) {
    console.log(`Something went wrong while updating source-data for application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);