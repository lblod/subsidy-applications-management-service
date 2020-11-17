import { app, errorHandler } from 'mu';

import { getFormData } from './lib/form-data';

app.get('/', function(req, res) {
  const message = 'Hey there, you have reached subsidy-applications-management-service! Seems like I\'m doing just fine! :)';
  res.send(message);
});

/**
 * Returns the **active** form-data in `text/turtle` format
 */
app.get('/subsidy-applications-form-data', async function(req, res, next) {
  try {
    const form = await getFormData();
    // TODO can we go from text-turtle to application/n-triples? (consistency)
    return res.status(200).set('content-type', 'text/turtle').send(form);
  } catch (e) {
    console.log(`Something went wrong while retrieving the form-data:`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);