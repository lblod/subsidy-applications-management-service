import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';

import { waitForDatabase } from './lib/util/database';
import { Model } from './lib/model-mapper/entities/model';
import { ModelMapper } from './lib/model-mapper/model-mapper';
import { SemanticFormManagement } from './lib/services/semantic-form-management';
import { ConfigurationFiles } from './lib/services/configuration-files';
import { MetaFiles } from './lib/services/meta-files';
import { SourceDataExtractor } from './lib/services/source-data-extractor';
import { DEV_ENV, SEMANTIC_FORM_RESOURCE_BASE, SERVICE_NAME } from './env';
import { MetaDataExtractor } from './lib/services/meta-data-extractor';

/**
 * Setup and API.
 */

app.use(bodyParser.json({
  type: function(req) {
    return /^application\/json/.test(req.get('content-type'));
  },
}));

/**
 * Hello world (basic is alive test).
 */
app.get('/', function(req, res) {
  const message = `Hey there, you have reached ${SERVICE_NAME}! Seems like I\'m doing just fine, have a nice day! :)`;
  res.send(message);
});

let config_files;
let meta_files;
let management;

/**
 * NOTE: on restart of a stack we need to wait for the database to be ready.
 */
waitForDatabase().then(async () => {
  try {
    config_files = await new ConfigurationFiles().init();
    meta_files = await new MetaFiles(config_files).init();
    management = new SemanticFormManagement(config_files, meta_files);
  } catch (e) {
    console.error(e);
    console.log('Service failed to start because of an unexpected error, closing ...');
    process.exit();
  }
});

/**
 * Returns the latest sources to be used on a semantic-form.
 *
 * Sources are all the files used to construct a form within this service.
 *
 * @returns Object {
 *   form,
 *   config,
 *   meta
 * }
 *
 */
app.get('/sources/latest', async function(req, res) {
  try {
    const sources = management.getLatestSources();
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
 * Retrieves the semantic-form-bundle containing all the needed data to construct a form
 * on a client for the given UUID.
 *
 * @param uuid - unique identifier of the semantic-form to retrieve the semantic-form-bundle for.
 * @returns SemanticFormBundle
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
 * Updates the semantic-form for the given UUID based on the delta {additions, removals}.
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
 * Delete the semantic-form for the given UUID.
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
 * Submit the semantic-form for given UUID.
 *
 * @param uuid - unique identifier of the semantic-form to be submitted
 */
app.post('/semantic-forms/:uuid/submit', async function(req, res) {
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
 * Map the semantic-form for the given UUID to the configured model-mapping.
 *
 * @param uuid - unique identifier of the semantic-form to be mapped
 * @returns string - n-triple generated model
 */
app.get('/semantic-form/:uuid/map', async function(req, res, next) {
  if (DEV_ENV) {
    const uuid = req.params.uuid;
    try {
      let {prefixes, resource_definitions, mapping} = config_files.mapper.content;
      const model = new Model(resource_definitions, prefixes);
      const root = `${SEMANTIC_FORM_RESOURCE_BASE}${uuid}`;
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

/**
 * Get the source-data for the semantic-form with the given UUID.
 *
 * @param uuid - unique identifier of the semantic-form to be mapped
 * @returns string - n-triple generated source-data
 */
app.get('/semantic-form/:uuid/source-data', async function(req, res, next) {
  if (DEV_ENV) {
    const uuid = req.params.uuid;
    try {
      // TODO redo with new spec
      const extractor = new SourceDataExtractor({sudo: true});
      const uri = `${SEMANTIC_FORM_RESOURCE_BASE}${uuid}`;
      const source = await extractor.extract(uri, config_files.specification.definition);
      return res.status(200).set('content-type', 'application/json').send(source);
    } catch (e) {
      if (e.status) {
        return res.status(e.status).set('content-type', 'application/json').send(e);
      }
      console.log(`Something went wrong extracting source-data`);
      console.log(e);
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'application/n-triples').send();
});

/**
 * Get meta-data.
 *
 * @returns string - n-triple meta-data
 */
app.get('/meta-data', async function(req, res, next) {
  if (DEV_ENV) {
    try {
      // NOTE: by default we take the latest.
      let meta = meta_files.latest.content;
      // NOTE: if a request body was given, we create meta-data based on this.
      if (req.body.length > 0) {
        const schemes = req.body;
        meta = await new MetaDataExtractor().extract(schemes);
      }
      return res.status(200).set('content-type', 'application/json').send(meta);
    } catch (e) {
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'application/n-triples').send();
});

app.use(errorHandler);