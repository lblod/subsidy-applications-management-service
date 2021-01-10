import { Property } from '../../entities/property';

export default async function resolve(resolution, object, model) {
  const resource = model.getResource(resolution.resource);
  new Property({predicate: resolution['s-prefix'], object: {value: object.value, datatype: object.type}}, resource);
}