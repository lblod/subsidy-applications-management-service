import { app, errorHandler } from 'mu';

app.get('/', function( req, res ) {
  const message = 'Hey there, you have reached subsidie-aanvragen-management-service! Seems like I\'m doing just fine! :)';
  res.send(message);
});

app.use(errorHandler);