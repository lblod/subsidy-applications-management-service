# subsidy-applications-management-service

Service that provides management of one or more SemanticForm(s).

This includes but is not limited to:
- providing and managing all the (meta)data needed to construct/visualize a SemanticForm
- updating and deleting the source-data of a SemanticForm
    - Note: **NOT** creating
- submitting a SemanticForm
- **experimental**: writing tailored meta/source-data extractors

## Table of contents

- [**Setup**](#setup)
    - [**In a `mu.semte.ch` stack**](#within-a-musemtech-stack)
    - [**Environment variables**](#environment-variables)
- [**Configuration**](#configuration)
    - [**SemanticForm(s)**](#semanticforms)
        - [**SemanticFormDirectory**](#semanticforms-the-semanticformdirectory)
        - [**SemanticFormSpecification**](#semanticforms-the-semanticformspecification)
        - [**[experimental] Tailored data**](#experimental-semanticforms-tailored-data)
    - [**[deprecated] ~~Mapper~~**](#deprecated-mapper)
- [**Generates**](#generates)
    - [**MetaData**](#semanticforms-metadata)
- [**API**](#api)
    - [**Get the configuration and latest meta-data to be used.**](#get-the-configuration-and-latest-meta-data-to-be-used)
    - [**Get all the meta(data) needed to construct a semantic form.**](#get-all-the-metadata-needed-to-construct-a-semantic-form)
    - [**Update the source-data based on a given delta**](#update-the-source-data-based-on-a-given-delta)
    - [**Delete all the source-data for a semantic-form**](#delete-all-the-source-data-for-a-semantic-form)
    - [**Submit a semantic-form**](#submit-a-semantic-form)
    - [**Sync all meta-data**](#sync-all-meta-data)
- [**Developing in the `mu.semte.ch` stack**](#development)

## Setup

### Within a [`mu.semte.ch`](https://github.com/mu-semtech) stack

Paste the following snip-it in your `docker-compose.yml`:

```yaml
version: '3.4'

services:
  subsidy-applications-management:
    image: lblod/subsidy-applications-management-service
    volumes:
        # change to location of configuration
      - ./my-config:/config
        # change to location of file storage
      - ./my-file-storage:/data
```

### Environment variables

These can be added in within the docker declaration.

| Name                               | Description                                                                     | Default                                                                                                                         |
|------------------------------------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `SERVICE_NAME`                     | The name of the service.  Mainly used to identify the service's created files.  | "subsidy-application-management-service"                                                                                        |
| `SEMANTIC_FORM_TYPE`               | The type that should be used for managed semantic-forms.                        | `lblodSubsidie:ApplicationForm`                                                                |
| `SEMANTIC_FORM_RESOURCE_BASE`      | Resource URI base to be used when creating new semantic-forms.                  | "http://data.lblod.info/application-forms/"                                                                                     |
| `SEMANTIC_FORM_CONFIGURATION_ROOT` | Root location of semantic-form configurations within the `config` volume.       | `/config/forms/`                                                                                                                |
| `QUERY_CHUNK_SIZE`                 | Maximum triple chunk for mutation data queries.                                 | 50                                                                                                                              |
| `META_DATA_ROOT`                   | Root location of meta-data within the `data` volume                             | `data/meta-files/`                                                                                                              |
| `META_DATA_CRON`                   | Interval when to retry generating meta-data                                     | `0 */15 8-18 * * 1-5` “At every 15th minute past every hour from 8 through 18 on every day-of-week from Monday through Friday.” |
| `META_DATA_STALE_CRON_STOP`        | After how many days the `META_DATA_CRON` is considered "stale"               | 5                                                                                                                               |
| `META_DATA_EXTRACTION_BLACK_LIST`           | concept-scheme values that should be ignored |                 |

> **Developer note**:  
> For the more tech-savvy, you can also take a peek in `env.js` for a more detailed look.

## Configuration

### SemanticForm(s)

To start managing forms, you'll first need to configure forms. We'll do this within the [`SEMANTIC_FORM_CONFIGURATION_ROOT`](#environment-variables).

You'll create a new SemanticForm by:
1) Creating a [SemanticFormDirectory](#semanticforms-the-semanticformdirectory)
2) Populate the [SemanticFormDirectory](#semanticforms-the-semanticformdirectory), `/versions` directory, with a [SemanticFormSpecification](#semanticforms-the-semanticformspecification)

When finished, you'll end up with a structure that could look similar to this:

- 📂 [`SEMANTIC_FORM_CONFIGURATION_ROOT`](#environment-variables)
    - 📂 my-form
        - 📂 versions
            - 📂 20201231153419-initial-from
                - 📝 config.json
                - 📝 form.ttl
            - 📁 20201231153459-added-new-sub-form

### SemanticForm(s): The SemanticFormDirectory

The service can manage one or more SemanticForm(s). This is achieved by creating SemanticFormDirectories. These directories contain everything the service will need to build, enhance and manage the SemanticFormBundle for the client.

#### How to create a SemanticFormDirectory

Defining a [SemanticFormDirectory](#semanticforms-the-semanticformdirectory) has been kept rather simple. You achieve this by creating a directory within the [`SEMANTIC_FORM_CONFIGURATION_ROOT`](#environment-variables) that contains a sub-directory called `/versions`:

```shell
# we have only one form
$ mkdir versions
```
```shell
# we want to name our form(s)
$ mkdir -p /my-form/versions
```
```shell
# we want to nest our form(s)
$ mkdir -p phase-1/my-form/versions
```

Simply put, any recursively nested folder within the [`SEMANTIC_FORM_CONFIGURATION_ROOT`](#environment-variables) containing a `/versions` folder, is picked-up as a SemanticFormDirectory.

> **Developer note:**  
> In theory, you could create any desired directory structure within the [`SEMANTIC_FORM_CONFIGURATION_ROOT`](#environment-variables).  
> **But, this has never been extensively tested. So explore this at your own discretion**.

#### What is the `/versions` sub-directory?

Directory where your different versions of [SemanticFormSpecification](#semanticforms-the-semanticformspecification) will live.

> **Note:** This sub-directory is **required** for the parent directory to be recognized as a [SemanticFormDirectory](#semanticforms-the-semanticformdirectory) and cannot hold another name.

### SemanticForm(s): The SemanticFormSpecification

Is a timestamped directory, within the [`/versions`](#what-is-the-versions-sub-directory) directory containing a pair of two files:
- [The turtle form-specification](#the-turtle-form-specification)
- [The json meta-data for the turtle form-specification](#the-json-meta-data-for-the-turtle-form-specification)

All [SemanticFormSpecification](#semanticforms-the-semanticformspecification) directories are **required** to have a **timestamp** in the [format](https://momentjs.com/docs/#/parsing/string-format/) `YYYYMMDDhhmmss` followed by a dash(-) and a title/description. This timestamp will be inferred as the creation date of its configuration files.

#### What about migrations, should the files be added manually to the store?

No, migrations are not required. The files are inserted into the store by the service itself. We follow the same [model](https://github.com/mu-semtech/file-service#model) as defined by the [file-service](https://github.com/mu-semtech/file-service).

#### UUID generation

To ensure consistent UUID generation on different environments, we make use of [UUIDv5](https://datatracker.ietf.org/doc/html/rfc4122#section-4.3) with a fixed namespace.

> **Developer note**:  
> For the more tech-savvy, the following namespace & name are used when generating the UUID's:
>   - physical UUID: `uuidv5("77219b1e-e23d-4828-847f-55e2d7fac687", [physical-uri])`
>   - virtual UUID:  `uuidv5("77219b1e-e23d-4828-847f-55e2d7fac687", [physical-uuid])`

#### The turtle form-specification

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

#### The json meta-data for the turtle form-specification

```json
{
  "meta": {
    "schemes": [
    ]
  },
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
> **Developer note**:
> - `meta.schemes` is optional.
> - properties can be nested indefinitely.

### [experimental] SemanticForm(s): Tailored data

Sometimes SemanticForms need to be enhanced with user specific business logic, for this the concept of tailored data was introduced. **Take notice that this is still very experimental. Use at your own discretion.**

#### How to create tailored meta/source-data extractors

Tailored data is SemanticForm specific, so you'll have to navigate to the matching [SemanticFormDirectory](#semanticforms-the-semanticformdirectory). Next to the `/versions` directory, you'll create the following directories:

```shell
# meta data extractors
$ mkdir -p tailored/meta
```
```shell
# source data extractors
$ mkdir -p tailored/source
```
Within these directories you'll define an `index.js` that exports an array of extractors. These will be called on enhancement of a new SemanticForm.

> NOTE: these extractors run in the order of definition

For a starter example, take a look in root of this repository under `./examples`.

### [deprecated] ~~Mapper~~

At inception, to be submitted SemanticForms would be mapped to a pre-defined (clean) model.

This mapper provided the functionality to create new resources, map/copy fields and create relations to map the SemanticForm fields to the correct pre-defined model.

This functionality was abandoned after the responsibility was moved to other services in an effort to simplify the process.  
See [commit](https://github.com/lblod/subsidy-applications-management-service/commit/945af4b7b7e388f139d51ffe9494edb1500e7bb9).

## Generates

### SemanticForm(s): MetaData

Extra data that is needed by the client to correctly render the form. **Initially, at startup, the service does not generate meta-data.** It only starts once a client has requested a SemanticForm that needs meta-data.

#### Where and how is it stored?

All the meta-data is stored in turtle files. These files can be found in the [`META_DATA_ROOT`](#environment-variables) under the same folder structure defined by its paired SemanticFormDirectory.

#### Is the meta-data up-to-date?

To ensure that the meta-data is up-to-date, when a user requests a new SemanticForm to be build, a process is started to generate the required meta-data.

This process can be very expensive and time-consuming. Therefore, a background task is triggered to check at predefined intervals if the meta-data has been updated. If the meta-data is out-of-date, a new updated meta-data file is generated.

To prevent dangling background processes, if this background task was not triggered by a client within the specified [`META_DATA_STALE_CRON_STOP`](#environment-variables) days, it is turned off.

#### Wouldn't it be too eager during a migration that targets the meta-data sources?

To prevent this from happening, if a change to the meta-data is detected, a backoff was implemented.

This means that if a change was detected, it will wait and retry. If it changed again, we assume to be in an unstable state. So we, backoff and retry again later. This process will continue until:
1. the meta-data source have stabilized
2. maximum backoff wait has been reached, meaning we'll retry at a later rotation

<details>
<summary>Backoff environment variables</summary>

These can be added in within the docker declaration.

| Name                                        | Description                                  | Default         |
|---------------------------------------------|----------------------------------------------|-----------------|
| `META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT` | The initial wait time                        | 5000            |
| `META_DATA_EXTRACTION_BACKOFF_RATE`         | backoff rate                                 | 0.3             |
| `META_DATA_EXTRACTION_BACKOFF_MAX_WAIT`     | maximum wait time                            | 600000 "10 min" |
</details>

## API

### Get the configuration and latest meta-data to be used.

> **GET** `/sources/latest?uri`

```
HTTP/1.1 
200 OK
X-Powered-By: Express
content-type: application/json; charset=utf-8

{
  "configuration": {
    "specification": ""
    "tailored": {
      "meta": ""
      "source": ""
    }
  },
  "meta": "",
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
```

### Submit a semantic-form

> **POST** `/semantic-forms/:uuid/submit`

#### Response
```
HTTP/1.1 
204 No Content
x-powered-by: Express
```

### Sync all meta-data

> **GET** `/meta/sync`

> NOTE: heavy request as this triggers an update for all configured SemanticFormSpecifications

#### Response
```
HTTP/1.1 
204 No Content
x-powered-by: Express
```


## Development

For a more detailed look in how to develop a microservices based on the [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template), we would recommend reading "[Developing with the template](https://github.com/mu-semtech/mu-javascript-template#developing-with-the-template)".

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
