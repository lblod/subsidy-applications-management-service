import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { waitForDatabase } from './lib/util/database';
import { Model } from './lib/model-mapper/entities/model';
import { ModelMapper } from './lib/model-mapper/model-mapper';
import { SemanticFormManagement } from './lib/services/semantic-form-management';
import { Configuration } from './lib/services/configuration';
import { MetaData } from './lib/services/meta-data';
import { SourceDataGeneration } from './lib/services/source-data-generation';
import { DEV_ENV, SERVICE_NAME } from './env';

app.use(bodyParser.json({
  type: function(req) {
    return /^application\/json/.test(req.get('content-type'));
  },
}));

app.get('/', function(req, res) {
  const message = `Hey there, you have reached ${SERVICE_NAME}! Seems like I\'m doing just fine, have a nice day! :)`;
  res.send(message);
});

let config_files;
let meta_data;
let management;

waitForDatabase().then(async () => {
  config_files = await new Configuration().init();
  meta_data = await new MetaData(config_files).init();
  management = new SemanticFormManagement(config_files, meta_data);
});

/**
 * Returns the latest sources to be used on a semantic-form.
 */
app.get('/latest-sources', async function(req, res) {
  try {
    const sources = {
      form: config_files.specification,
      config: config_files.config,
      meta: meta_data.latest,
    };
    return res.status(200).set('content-type', 'application/json').send(sources);
  } catch (e) {
    const response = {
      status: 500,
      message: 'Something unexpected went wrong while trying to retrieve the latest sources.',
    };
    console.error(e);
    return res.status(response.status).set('content-type', 'application/json').send(response);
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
app.get('/semantic-forms/:uuid', async function(req, res) {
  const uuid = req.params.uuid;
  try {
    const {bundle} = await management.getSemanticFormBundle(uuid);
    return res.status(200).set('content-type', 'application/json').send(bundle);
  } catch (e) {
    console.error(e);
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    const response = {
      status: 500,
      message: `Something unexpected went wrong while retrieving the semantic-form for "${uuid}".`,
    };
    return res.status(response.status).set('content-type', 'application/json').send(response.message);
  }
});

/**
 * Updates the source-data for the given semantic-form based on the given delta {additions, removals}.
 *
 * @param uuid - unique identifier of the semantic-form to update
 * @body delta {additions, removals} - object containing the triples to be added and removed.
 */
app.put('/semantic-forms/:uuid', async function(req, res) {
  const uuid = req.params.uuid;
  const delta = req.body;
  try {
    await management.updateSemanticForm(uuid, delta);
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    const response = {
      status: 500,
      message: `Something unexpected went wrong while updating the semantic-form for "${uuid}".`,
    };
    return res.status(response.status).set('content-type', 'application/json').send(response.message);
  }
});

/**
 * Delete all the source-data for the given semantic-form.
 *
 * @param uuid - unique identifier of the semantic-form to be deleted
 */
app.delete('/semantic-forms/:uuid', async function(req, res) {
  const uuid = req.params.uuid;
  try {
    await management.deleteSemanticForm(uuid);
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    const response = {
      status: 500,
      message: `Something unexpected went wrong while deleting the semantic-form for "${uuid}".`,
    };
    return res.status(response.status).set('content-type', 'application/json').send(response.message);
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
    await management.submitSemanticForm(uuid);
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    const response = {
      status: 500,
      message: `Something unexpected went wrong while submitting semantic-form for "${uuid}".`,
    };
    return res.status(response.status).set('content-type', 'application/json').send(response.message);
  }
});

/* [FOR TESTING/DEVELOPMENT PURPOSES ONLY] */

/**
 * Map the given semantic form to the configured model
 * NOTE: this has no auth barrier, to be only used for dev/testing.
 */
app.get('/semantic-form/:uuid/map', async function(req, res, next) {
  if (DEV_ENV) {
    const uuid = req.params.uuid;
    try {
      let {prefixes, resource_definitions, mapping} = config_files.mapper.content;
      const model = new Model(resource_definitions, prefixes);
      const root = `http://data.lblod.info/application-forms/${uuid}`;
      await new ModelMapper(model, {sudo: true}).map(root, mapping);

      return res.status(200).set('content-type', 'application/n-triples').send(model.toNT());
    } catch (e) {
      console.log(`Something went wrong while mapping semantic-form with uuid "${uuid}"`);
      console.log(e);
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'application/n-triples').send();
});

app.get('/semantic-form/:uuid/generate-source', async function(req, res, next) {
  if (DEV_ENV) {
    const uuid = req.params.uuid;
    try {
      const source = new SourceDataGeneration(config_files);
      const uri = `http://data.lblod.info/application-forms/${uuid}`;
      const definition = config_files.config.content['resource'];
      const content = await source.generate(uri, definition);
      return res.status(200).set('content-type', 'application/json').send(content);
    } catch (e) {
      if (e.status) {
        return res.status(e.status).set('content-type', 'application/json').send(e);
      }
      console.log(`Something went wrong while synchronizing versioned configuration`);
      console.log(e);
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'application/n-triples').send();
});

app.use(errorHandler);