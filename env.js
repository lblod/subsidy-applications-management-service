const ACTIVE_FORM = process.env.ACTIVE_FORM || 'form.ttl';
const META_DATA = process.env.META_DATA || 'meta.ttl';

const ACTIVE_FORM_URI = `share://${ACTIVE_FORM}`;
const META_DATA_URI = `share://${META_DATA}`;

export {
  ACTIVE_FORM,
  ACTIVE_FORM_URI,
  META_DATA_URI
}