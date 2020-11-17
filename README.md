# subsidy-applications-management-service

Service that provides management related to subsidy-applications (subsidie aanvragen) semantic forms.

This includes but is not limited to:
- providing the form-data


  // TODO
- providing the meta-data
- creating, updating and deleting source-data

## Installation

To add the service to your `mu.semte.ch` stack, add the following snippet to docker-compose.yml:

```yaml
services:
  subsidy-applications-managment:
    image: lblod/subsidy-applications-management-service:x.x.x
    volumes:
      - ./config/semanctic-form-path:/share
```
> **NOTE**: Make sure to mount `/share` as this folder should contain the form-data configuration turtle files.

## Configuration

### Environment variables

| Name                      | Description                                           | Default               |
|---------------------------|-------------------------------------------------------|-----------------------|
|       `ACTIVE_FORM`       |       The active form/form-data turtle filename.      |       `form.ttl`      |

## API

### GET /active-form-data/

> Retrieve the active form/form-data.

#### Response
````
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/turtle; charset=utf-8
Content-Length: xx
Date: Tue, 17 Nov 2020 08:47:01 GMT
Connection: keep-alive

@prefix form: <http://lblod.data.gift/vocabularies/forms/> .
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix mu: <http://mu.semte.ch/vocabularies/core/> .
@prefix fields: <http://data.lblod.info/fields/> .

fields:8e24d707-0e29-45b5-9bbf-a39e4fdb2c11 a form:PropertyGroup;
    mu:uuid "8e24d707-0e29-45b5-9bbf-a39e4fdb2c11";
    sh:description "parent property-group, used to group fields and property-groups together";
    sh:order 1 .
````

## Development

For a more detailed look in how to develop a microservices based on
the [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template), we would recommend
reading "[Developing with the template](https://github.com/mu-semtech/mu-javascript-template#developing-with-the-template)"

### Developing in the `mu.semte.ch` stack

Paste the following snip-it in your `docker-compose.override.yml`:

````yaml  
subsidy-applications-managment:
  image: semtech/mu-javascript-template:1.4.0
  ports:
    - 8888:80
    - 9229:9229
  environment:
    NODE_ENV: "development"
  volumes:
    - /absolute/path/to/your/sources/:/app/
    - ./config/semanctic-form-path:/share
````
