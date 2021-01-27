import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { waitForDatabase } from './lib/util/database';
import { FILES, FormVersionService } from './lib/services/form-version-service';
import { uriToPath } from './lib/util/file';
import { Model } from './lib/model-mapper/entities/model';
import { ModelMapper } from './lib/model-mapper/model-mapper';
import { SemanticFormService } from './lib/services/semantic-form-service';

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
let semanticFormService;

waitForDatabase().then(async () => {
  versionService = await new FormVersionService().init();
  semanticFormService = new SemanticFormService(versionService);
});

/**
 * Returns the active-form-directory.
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
 * Retrieves all the (meta)data needed to construct a form on the client side for the given semantic-form.
 *
 * @param uuid - unique identifier of the semantic-form to retrieve the form (meta)data for.
 *
 * @returns Object {
 *   form - the form triples, used to construct the actual visualisation off the form (format: `application/n-triples`)
 *   source - the source triples, all the model data for the semantic-form  (format: `application/n-triples`)
 *   meta - the meta triples, all the meta data used to construct the actual visualisation off the form  (format: `application/n-triples`)
 * }
 *
 */
app.get('/semantic-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    const form_data = await semanticFormService.getFormData(uuid)
    return res.status(200).set('content-type', 'application/json').send({
      source: form_data.source,
      form: form_data.form,
      meta: form_data.meta,
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
 * Updates the source-data for the given semantic-form based on the given delta {additions, removals}.
 *
 * @param uuid - unique identifier of the semantic-form to update
 * @body delta {additions, removals} - object containing the triples to be added and removed.
 */
app.put('/semantic-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  const delta = req.body;
  try {
    await semanticFormService.updateFormData(uuid, delta);
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
 * Delete all the source-data for the given semantic-form.
 *
 * @param uuid - unique identifier of the semantic-form to be deleted
 */
app.delete('/semantic-forms/:uuid', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    await semanticFormService.deleteFormData(uuid);
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
 * Submit the given semantic-form.
 *
 * @param uuid - unique identifier of the semantic-form to be submitted
 */
app.post('/semantic-forms/:uuid/submit', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {
    await semanticFormService.submitSemanticForm(uuid);
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

/**
 * Map the given semantic form to the configured model
 * NOTE: this has no auth barrier, to be only used for dev/testing.
 */
app.get('/semantic-form/:uuid/map', async function(req, res, next) {
  const uuid = req.params.uuid;
  try {

    let {prefixes, resource_definitions, mapping} = require(uriToPath(`${versionService.active.uri}/${FILES.mapper}`));
    const model = new Model(resource_definitions, prefixes);
    const root = `http://data.lblod.info/application-forms/${uuid}`;
    await new ModelMapper(model, {sudo: true}).map(root, mapping);

    return res.status(200).set('content-type', 'application/n-triples').send(model.toNT());
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'plain/text').send(e);
    }
    console.log(`Something went wrong while mapping semantic-form with uuid <${uuid}>`);
    console.log(e);
    return next(e);
  }
});


import { MetaGenerationService } from './lib/services/meta-generation-service';

app.get('/meta-gen', async function(req, res, next) {
  const metaService = new MetaGenerationService(versionService);
  try {
    const meta = await metaService.generate();
    return res.status(200).set('content-type', 'application/n-triples').send(meta);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).set('content-type', 'plain/text').send(e);
    }
    console.log(`Something went wrong while generating meta-data`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);