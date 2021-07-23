import { app, errorHandler } from 'mu';

import bodyParser from 'body-parser';
import moment from 'moment';

import { waitForDatabase } from './lib/util/database';
import { Configuration } from './lib/services/configuration';
import { SourceDataExtractor } from './lib/services/source-data-extractor';
import { DEV_ENV, SEMANTIC_FORM_RESOURCE_BASE, SERVICE_NAME } from './env';
import { MetaDataExtractor } from './lib/services/meta-data-extractor';
import { TailoredMetaDataExtractor } from './lib/services/tailored-meta-data-extractor';
import { SemanticFormBundle } from './lib/entities/semantic-form-bundle';
import { SemanticFormManagement } from './lib/services/semantic-form-management';

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

let configuration;
let management;

/**
 * NOTE: on restart of a stack we need to wait for the database to be ready.
 *
 * TODO: we should also try awaiting the migrations service.
 */
waitForDatabase().then(async () => {
  try {
    configuration = await new Configuration().init();
    management = new SemanticFormManagement(configuration);
  } catch (e) {
    console.error(e);
    console.warning('Service failed to start because of an error, closing ...');
    process.exit();
  }
});

/**
 * Returns the latest sources to be used on a semantic-form.
 *
 * Sources are all the files used to construct a form within this service.
 *
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
    if (!req.query.uri)
      return res.status(400).set('content-type', 'application/json').send({
        status: 400,
        message: `Query param form URI is required`
      });
    const uri = req.query.uri;
    const latest = await configuration.sources.getLatest(uri);
    return res.status(200).set('content-type', 'application/json').send(latest);
  } catch (e) {
    console.error(e);
    if (e.status) {
      return res.status(e.status).set('content-type', 'application/json').send(e);
    }
    const response = {
      status: 500,
      message: 'Something unexpected went wrong while trying to retrieve the latest sources.',
    };
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

/**
 * Sync the meta.
 *
 * @returns string - n-triple meta-data
 */
app.get('/meta/sync', async function(req, res, next) {
  console.log(`Meta-files sync. triggered by API call at ${moment()}`);
  try {
    await configuration.sources.syncAllMeta();
  } catch (e) {
    return next(e);
  }
  return res.status(200).set('content-type', 'application/json').send(configuration.sources.metaByFormURI);
});

/* [FOR TESTING/DEVELOPMENT PURPOSES ONLY] */

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
      const extractor = new SourceDataExtractor({sudo: true});
      const uri = `${SEMANTIC_FORM_RESOURCE_BASE}${uuid}`;
      const source = await extractor.extract(uri, configuration.specification.definition);
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
  return res.status(403).set('content-type', 'plain/text').send();
});

/**
 * Extract meta.
 *
 * @returns string - n-triple meta-data
 */
app.get('/meta/extract', async function(req, res, next) {
  if (DEV_ENV) {
    try {
      // NOTE: if a request body was given, we create meta-data based on this.
      let current = '';
      if (req.body.length > 0) {
        const schemes = req.body;
        current = await new MetaDataExtractor().extract(schemes);
      }
      return res.status(200).set('content-type', 'application/json').send(current);
    } catch (e) {
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'plain/text').send();
});

app.get('/meta/tailored/extract', async function(req, res, next) {
  if (DEV_ENV) {
    if (!req.query.uri)
      throw `Query param form URI is required`;
    const uri = req.query.uri;
    try {
      const config = configuration.sources.getConfiguration(uri);
      if (config.tailored.meta) {
        const delta = await new TailoredMetaDataExtractor().execute(config.tailored.meta.content);
        return res.status(200).set('content-type', 'application/json').send(delta);
      }
      return res.status(404).set('content-type', 'plain/text').send();
    } catch (e) {
      return next(e);
    }
  }
  return res.status(403).set('content-type', 'plain/text').send();
});

app.use(errorHandler);
