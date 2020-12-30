import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { Form } from './lib/form';
import { getFileContent } from './lib/util/file';
import { META_DATA_URI } from './env';
import { getActiveFormFile, syncFormFiles } from './lib/form-data';
import { waitForDatabase } from './lib/util/database';
import { VersionService } from './lib/versioning/version-service';

app.use(bodyParser.json({
  type: function(req) {
    return /^application\/json/.test(req.get('content-type'));
  },
}));

app.get('/', function(req, res) {
  const message = 'Hey there, you have reached subsidy-applications-management-service! Seems like I\'m doing just fine! :)';
  res.send(message);
});

let versionService;

waitForDatabase().then(async () => {
  // const active = await syncFormFiles();
  // console.log(`${active.uri} is marked the current active form-data file.`);
  versionService = new VersionService();
  await versionService.sync();
});

/**
 * Returns the active form file.
 */
app.get('/active-form-file', async function(req, res, next) {
  try {
    const dir = versionService.active;
    return res.status(200).set('content-type', 'application/json').send(dir.json);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something unexpected went wrong while retrieving the active-form-file.`);
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
 *   meta - the meta triples, all the meta data used to construct the actual visualisation off the form  (format: `application/n-triples`)
 * }
 *
 */
app.get('/application-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    const applicationForm = await new Form().init(uuid);
    const source = applicationForm.source;
    const form = applicationForm.form;
    let meta = '';
    try {
      meta = await getFileContent(META_DATA_URI);
    } catch (e) {
      // can fail for now (user not required to supply a meta-file)
      console.log(`no ${META_DATA_URI} could be found, meta-data will be empty`);
    }
    return res.status(200).set('content-type', 'application/json').send({
      form,
      source,
      meta,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
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
    const applicationForm = await new Form().init(uuid);
    await applicationForm.update(delta);
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
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
    const applicationForm = await new Form().init(uuid);
    await applicationForm.delete();
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something went wrong while updating source-data for application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.post('/application-forms/:uuid/submit', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    const applicationForm = await new Form().init(uuid);
    await applicationForm.submit();
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something went wrong while submitting application-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);