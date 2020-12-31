import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { SemanticForm } from './lib/semanticForm';
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
  versionService = await new VersionService().init();
});

/**
 * Returns the active form directory.
 */
app.get('/active-form-directory', async function(req, res, next) {
  try {
    const dir = versionService.active;
    return res.status(200).set('content-type', 'application/json').send(dir.json);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something unexpected went wrong while retrieving the active-form-directory.`);
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
    const semanticForm = await new SemanticForm(versionService).init(uuid);
    return res.status(200).set('content-type', 'application/json').send({
      source: semanticForm.source,
      form: semanticForm.form,
      meta: semanticForm.meta,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something unexpected went wrong while retrieving the semantic-form with uuid <${uuid}>`);
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
    const semanticForm = await new SemanticForm(versionService).init(uuid);
    await semanticForm.update(delta);
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something went wrong while updating source-data for semantic-form with uuid <${uuid}>`);
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
    const semanticForm = await new SemanticForm(versionService).init(uuid);
    await semanticForm.delete();
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something went wrong while updating source-data for semantic-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.post('/application-forms/:uuid/submit', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    const semanticForm = await new SemanticForm(versionService).init(uuid);
    await semanticForm.submit();
    return res.status(204).send();
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    console.log(`Something went wrong while submitting semantic-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);