import { app, errorHandler } from 'mu';

app.get('/', function(req, res) {
  const message = 'Hey there, you have reached subsidy-applications-management-service! Seems like I\'m doing just fine! :)';
  res.send(message);
});

app.get('/subsidy-applications-form-data', async function(req, res, next) {
  try {
    // TODO read and return form
    const form = null;
    return res.status(200).set('content-type', 'text/turtle').send(form);
  } catch (e) {
    console.log(`Something went wrong while retrieving the form-data:`);
    console.log(e);
    return next(e);
  }
});

app.use(errorHandler);