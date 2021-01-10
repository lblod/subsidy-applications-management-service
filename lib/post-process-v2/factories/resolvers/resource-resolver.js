
export default async function resolve(resolution, object, model) {
  const options = model._configuration.resources[resolution.resource];
  options['uri'] = object.value;
  model.addResource(resolution.resource, model._resourceFactory.produceResource(options))
}