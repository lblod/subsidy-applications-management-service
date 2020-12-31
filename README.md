# subsidy-applications-management-service

Service that provides management related to subsidy-applications (subsidie-aanvragen) semantic-forms.

This includes but is not limited to:
- semantic-form versioning
- providing all the (meta)data needed to construct/visualize a semantic-form
- updating and deleting the source-data of a semantic-form
- submitting a semantic-form

## Table of contents

- [**Installation**](#installation)
    - [**Environment variables**](#environment-variables)
- [**Configuration**](#configuration)
    - [**Form versioning**](#form-versioning)
        - [**Files: config.json**](#configuration-files-configjson)
        - [**Files: turtle files**](#configuration-files-turtle-files)
- [**API**](#api)
    - [**Get the current active form directory.**](#get-the-current-active-form-directory)
    - [**Get all the meta(data) needed to construct a semantic form.**](#get-all-the-metadata-needed-to-construct-a-semantic-form)
    - [**Update the source-data based on a given delta**](#update-the-source-data-based-on-a-given-delta)
    - [**Delete all the source-data for a semantic-form**](#delete-all-the-source-data-for-a-semantic-form)
    - [**Submit a semantic-form**](#submit-a-semantic-form)
- [**Developing in the `mu.semte.ch` stack**](#development)


## Installation

To add the service to your `mu.semte.ch` stack, add the following snippet to docker-compose.yml:

```yaml
services:
  subsidy-applications-management:
    image: lblod/subsidy-applications-management-service:x.x.x
    volumes:
      - ./config/semanctic-form-path:/share
```
> **NOTE**: Make sure to mount the `/share` directory as this location should contain all the configuration for this 
> service to work correctly.

### Environment variables

Provided [environment variables](https://docs.docker.com/compose/environment-variables/) by the service. These can be added in within the docker declaration.

| Name                     | Description                                                          | Default                                                        |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `SERVICE_NAME`           | The name off the service                                             | `subsidy-application-management-service`                       |
| `DATA_QUERY_CHUNK_SIZE`  | Represents the max amount off triples allowed within a query request | `50`                                                           |
| `FORM_VERSION_DIRECTORY` | Root directory off the form version directories                      | `/share/versions/`                                             |
| `SEMANTIC_FORM_TYPE`     | Type off the semantic forms to be processed                          | `http://lblod.data.gift/vocabularies/subsidie/ApplicationForm` |

## Configuration

Some extra configuration files/directories are needed for this service to work correctly. 
All these extra configuration will be created within the `/share` volume.

### Form versioning

Within the [`FORM_VERSION_DIRECTORY`](#environment-variables) you can drop **timestamped** directories. 
These will to contain all the files required to: construct, processes and visualize semantic-forms that can change over time.

All directories are **REQUIRED** to have a **timestamp** in the [format](https://momentjs.com/docs/#/parsing/string-format/) `YYYYMMDDhhmmss` followed by a dash(-) and a title/description.

#### Example directory structure:

- 📂 share
    - 📂 versions
        - 📂 20201231153419-initial-from
            - 📝 config.json
            - 📝 form.ttl
        - 📁 20201231153459-added-new-sub-form
 

### Configuration files: config.json

This file contains all static configuration data to be used by the service.
 
#### Example:

```json
{
  "resource": {
    "prefixes": [
      "PREFIX mu: <http://mu.semte.ch/vocabularies/core/>",
      "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
      "PREFIX dct: <http://purl.org/dc/terms/>",
      "PREFIX skos: <http://www.w3.org/2004/02/skos/core#>",
      "PREFIX schema: <http://schema.org/>",
      "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"
    ],
    "properties": [
      "rdf:type",
      "mu:uuid",
      "dct:source",
      "skos:prefLabel",
      {
        "s-prefix": "schema:contactPoint",
        "properties": [
          "foaf:firstName",
          "foaf:familyName",
          "schema:telephone",
          "schema:email"
        ]
      }
    ]
  }
}
```
> **NOTE**: properties can be nested indefinitely.
    
### Configuration files: turtle-files

Within this folder you also drop the `.ttl` files to be used to: construct, processes and visualize semantic-forms

#### Example

```
@prefix form: <http://lblod.data.gift/vocabularies/forms/> .
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix mu: <http://mu.semte.ch/vocabularies/core/> .
@prefix fieldGroups: <http://data.lblod.info/field-groups/> .
@prefix fields: <http://data.lblod.info/fields/> .
@prefix displayTypes: <http://lblod.data.gift/display-types/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

##########################################################
#  property-group
##########################################################
fields:8e24d707-0e29-45b5-9bbf-a39e4fdb2c11 a form:PropertyGroup;
    mu:uuid "8e24d707-0e29-45b5-9bbf-a39e4fdb2c11";
    sh:description "parent property-group, used to group fields and property-groups together";
    sh:name "This is a simple example form configuration ttl, make sure you correctly mapped your own form configuration" ;
    sh:order 1 .

##########################################################
# basic field
##########################################################
fields:147a32fe-f3dd-47f0-9dc5-43e46acc32cb a form:Field ;
    mu:uuid "147a32fe-f3dd-47f0-9dc5-43e46acc32cb";
    sh:name "Basic input field" ;
    sh:order 10 ;
    sh:path skos:prefLabel ;
    form:displayType displayTypes:defaultInput ;
    sh:group fields:8e24d707-0e29-45b5-9bbf-a39e4fdb2c11 .

##########################################################
# form
##########################################################
fieldGroups:main a form:FieldGroup ;
    mu:uuid "70eebdf0-14dc-47f7-85df-e1cfd41c3855" ;
    form:hasField fields:147a32fe-f3dd-47f0-9dc5-43e46acc32cb . ### Basic input-field

form:6b70a6f0-cce2-4afe-81f5-5911f45b0b27 a form:Form ;
    mu:uuid "6b70a6f0-cce2-4afe-81f5-5911f45b0b27" ;
    form:hasFieldGroup fieldGroups:main .

```

## API

### Get the current active form directory.

> **GET** `/active-form-directory`

```
HTTP/1.1 
200 OK
X-Powered-By: Express
content-type: application/json; charset=utf-8
Date: Tue, 17 Nov 2020 08:47:01 GMT

{
  type: "form-version-directory",
  id: "1",
  attributes: {
    uri: "share://versions/YYYYMMDDhhmmss-active-form-directory",
  }
}
```

### Get all the meta(data) needed to construct a semantic form.

> **GET** `/semantic-forms/:uuid`

#### Response

```
HTTP/1.1 
200 OK
X-Powered-By: Express
content-type: application/json; charset=utf-8
Date: Tue, 17 Nov 2020 08:47:01 GMT

{
  "form": "",
  "meta": "",
  "source": ""
}
```

### Update the source-data based on a given delta

> **PUT** `/semantic-forms/:uuid`

#### Request
```
HTTP/1.1
Connection: keep-alive
Content-Length: xxx
content-type: application/json
Accept: application/json

{
  "additions": "",
  "removals": ""
}
```

### Delete all the source-data for a semantic-form

> **DELETE** `/semantic-forms/:uuid`

#### Response
```
HTTP/1.1 
204 No Content
x-powered-by: Express
Date: Tue, 17 Nov 2020 08:47:01 GMT
```

### Submit a semantic-form

> **POST** `/semantic-forms/:uuid/submit`

#### Response
```
HTTP/1.1 
204 No Content
x-powered-by: Express
Date: Tue, 17 Nov 2020 08:47:01 GMT
```

## Development

For a more detailed look in how to develop a microservices based on
the [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template), we would recommend
reading "[Developing with the template](https://github.com/mu-semtech/mu-javascript-template#developing-with-the-template)"

### Developing in the `mu.semte.ch` stack

Paste the following snip-it in your `docker-compose.override.yml`:

````yaml  
subsidy-applications-management:
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
