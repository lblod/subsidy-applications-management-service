import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { ApplicationForm } from './lib/application-form';
import { getFileContent } from './lib/util/file';
import { ACTIVE_FORM_URI } from './env';

// TODO add simple check to ensure everything required is in place?
export const CONFIGURATION = require('/share/config.json');

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
 * [DEPRECATED]
 * Returns the **active** form-data in `text/turtle` format
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

/**
 * Retrieves all the (meta)data needed to construct a form on the client side for the given application-form.
 *
 * @param uuid - unique identifier of the application-form to retrieve the form (meta)data for.
 *
 * @returns Object {
 *   form - the form triples, used to construct the actual visualisation off the form (format: `application/n-triples`)
 *   source - the source triples, all the model data for the application-form  (format: `application/n-triples`)
 * }
 */
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

/**
 * Updates the source-data for the given application-form based on the given delta {additions, removals}.
 *
 * @param uuid - unique identifier of the application-form to update
 * @body delta {additions, removals} - object containing the triples to be added and removed.
 */
app.put('/application-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  const delta = req.body;

  try {
    const applicationForm = await new ApplicationForm().init(uuid);
    await applicationForm.update(delta);
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/vnd.api+json').send({message: e.message});
    }
    console.log(`Something went wrong while updating source-data for application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

/**
 * Delete all the source-data for the given application-form.
 *
 * @param uuid - unique identifier of the application-form to be deleted
 */
app.delete('/application-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;

  try {
    const applicationForm = await new ApplicationForm().init(uuid);
    await applicationForm.delete();
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/vnd.api+json').send({message: e.message});
    }
    console.log(`Something went wrong while updating source-data for application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);