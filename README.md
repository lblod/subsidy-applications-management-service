# subsidy-applications-management-service

Microservice for the [mu-semtech](https://github.com/mu-semtech) stack that manages SemanticForms — RDF-based forms backed by a SPARQL triplestore.

This includes:

- Providing all the data needed to construct and render a SemanticForm (form specification, source data, metadata)
- Updating and deleting the source-data of a SemanticForm (note: **not** creating — that is handled upstream)
- Submitting a SemanticForm after validation
- **[experimental]** Writing tailored meta/source-data extractors for custom business logic

## Table of contents

- **[Setup](#setup)**
  - **[In a `mu.semte.ch` stack](#within-a-musemtech-stack)**
  - **[Environment variables](#environment-variables)**
- **[Configuration](#configuration)**
  - **[SemanticForm(s)](#semanticforms)**
    - **[SemanticFormDirectory](#semanticforms-the-semanticformdirectory)**
    - **[SemanticFormSpecification](#semanticforms-the-semanticformspecification)**
    - **[[experimental] Tailored data](#experimental-semanticforms-tailored-data)**
  - **[[deprecated] ~~Mapper](#deprecated-mapper)**~~
- **[Generates](#generates)**
  - **[MetaData](#semanticforms-metadata)**
- **[API](#api)**
  - **[Health check](#health-check)**
  - **[Get the configuration and latest meta-data](#get-the-configuration-and-latest-meta-data)**
  - **[Get all the data needed to construct a semantic form](#get-all-the-data-needed-to-construct-a-semantic-form)**
  - **[Update the source-data based on a given delta](#update-the-source-data-based-on-a-given-delta)**
  - **[Delete all the source-data for a semantic-form](#delete-all-the-source-data-for-a-semantic-form)**
  - **[Submit a semantic-form](#submit-a-semantic-form)**
  - **[Sync all meta-data](#sync-all-meta-data)**
- **[Developing in the `mu.semte.ch` stack](#development)**

## Setup

### Within a `[mu.semte.ch](https://github.com/mu-semtech)` stack

Paste the following snippet in your `docker-compose.yml`:

```yaml
services:
  subsidy-applications-management:
    image: lblod/subsidy-applications-management-service
    volumes:
        # change to location of your form configurations
      - ./my-config:/config
        # change to location of file storage
      - ./my-file-storage:/data
```

### Environment variables


| Name                                        | Description                                                                                                    | Default                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `SERVICE_NAME`                              | Name of the service, used to tag files created by this service.                                                | `"subsidy-application-management-service"`                     |
| `SEMANTIC_FORM_TYPE`                        | RDF type used for managed semantic-forms.                                                                      | `http://lblod.data.gift/vocabularies/subsidie/ApplicationForm` |
| `SEMANTIC_FORM_RESOURCE_BASE`               | Base URI used when referencing semantic-form resources.                                                        | `http://data.lblod.info/application-forms/`                    |
| `SEMANTIC_FORM_CONFIGURATION_ROOT`          | Root directory for form configurations inside the `config` volume.                                             | `/config/forms/`                                               |
| `QUERY_CHUNK_SIZE`                          | Maximum number of triples per mutation query. Tune this if you hit query size limits.                          | `50`                                                           |
| `META_DATA_ROOT`                            | Directory where generated metadata files are stored inside the `data` volume.                                  | `/data/meta-files/`                                            |
| `META_DATA_CRON`                            | Cron schedule for periodic metadata refresh.                                                                   | `0 */15 8-18 * * 1-5` *(every 15 min, 8am–6pm, Mon–Fri)*       |
| `META_DATA_STALE_CRON_STOP`                 | Number of days of inactivity after which the metadata cron job is stopped. Prevents dangling background tasks. | `5`                                                            |
| `META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT` | Initial wait time (ms) before retrying metadata extraction when an unstable state is detected.                 | `5000`                                                         |
| `META_DATA_EXTRACTION_BACKOFF_RATE`         | Exponential backoff multiplier applied on each retry.                                                          | `0.3`                                                          |
| `META_DATA_EXTRACTION_BACKOFF_MAX_WAIT`     | Maximum wait time (ms) between backoff retries.                                                                | `600000` *(10 min)*                                            |
| `META_DATA_EXTRACTION_BLACK_LIST`           | Comma-separated list of concept-scheme URIs to exclude from metadata extraction.                               | *(empty)*                                                      |
| `TAILORED_META_DATA_ROOT`                   | Directory where generated tailored metadata files are stored inside the `data` volume.                         | `/data/tailored-meta-files/`                                   |
| `DEBUG_LOGS`                                | Set to any value to enable verbose debug logging.                                                              | *(disabled)*                                                   |


> **Note:** For a full technical overview of all derived variables, see `env.js`.

## Configuration

### SemanticForm(s)

To start managing forms, you'll first need to configure them inside the `[SEMANTIC_FORM_CONFIGURATION_ROOT](#environment-variables)`.

Creating a new SemanticForm involves two steps:

1. Create a [SemanticFormDirectory](#semanticforms-the-semanticformdirectory)
2. Populate its `/versions` directory with a [SemanticFormSpecification](#semanticforms-the-semanticformspecification)

When finished, your directory structure will look something like this:

- 📂 `[SEMANTIC_FORM_CONFIGURATION_ROOT](#environment-variables)`
  - 📂 my-form
    - 📂 versions
      - 📂 20201231153419-initial-form
        - 📝 config.json
        - 📝 form.ttl
      - 📂 20201231153459-added-new-sub-form
        - 📝 config.json
        - 📝 form.ttl

### SemanticForm(s): The SemanticFormDirectory

The service can manage one or more SemanticForms. Each one lives in its own SemanticFormDirectory — a directory within the `[SEMANTIC_FORM_CONFIGURATION_ROOT](#environment-variables)` that contains a `/versions` sub-directory.

```shell
# a single form at the root
mkdir versions

# a named form
mkdir -p my-form/versions

# nested forms
mkdir -p phase-1/my-form/versions
```

Any recursively nested folder containing a `/versions` sub-directory is picked up as a SemanticFormDirectory.

> **Note:** Nesting beyond one level has not been extensively tested. Use at your own discretion.

#### What is the `/versions` sub-directory?

This is where the versioned [SemanticFormSpecifications](#semanticforms-the-semanticformspecification) live. The sub-directory **must** be named `versions` — this is what the service uses to recognise a valid SemanticFormDirectory.

### SemanticForm(s): The SemanticFormSpecification

A SemanticFormSpecification is a timestamped directory inside `/versions` that contains exactly two files:

- [The Turtle form specification](#the-turtle-form-specification) (`form.ttl`)
- [The JSON metadata for the form specification](#the-json-metadata-for-the-form-specification) (`config.json`)

The directory name **must** follow the format `YYYYMMDDhhmmss-<description>` — the timestamp is used as the creation date of the configuration files.

#### What about migrations — do files need to be added to the store manually?

No. The service inserts configuration files into the store automatically on startup. It follows the same [file model](https://github.com/mu-semtech/file-service#model) as the mu-semtech file-service.

#### UUID generation

To ensure consistent UUID generation across environments, [UUIDv5](https://datatracker.ietf.org/doc/html/rfc4122#section-4.3) with a fixed namespace is used:

- physical UUID: `uuidv5("77219b1e-e23d-4828-847f-55e2d7fac687", [physical-uri])`
- virtual UUID: `uuidv5("77219b1e-e23d-4828-847f-55e2d7fac687", [physical-uuid])`

#### The Turtle form specification

The `form.ttl` file defines the structure of the form using SHACL shapes — fields, groups, display types, and ordering.

```turtle
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
    sh:description "parent property-group, used to group fields together";
    sh:name "Example form" ;
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
    form:hasField fields:147a32fe-f3dd-47f0-9dc5-43e46acc32cb .

form:6b70a6f0-cce2-4afe-81f5-5911f45b0b27 a form:Form ;
    mu:uuid "6b70a6f0-cce2-4afe-81f5-5911f45b0b27" ;
    form:hasFieldGroup fieldGroups:main .
```

#### The JSON metadata for the form specification

The `config.json` file tells the service which concept schemes to fetch from the triplestore for rendering dropdowns/labels (`meta.schemes`), and which RDF properties to extract as the form's source data (`resource.properties`).

```json
{
  "meta": {
    "schemes": []
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

> **Important:** Only include properties that are actually used in the `form.ttl`. Extra properties can cause unexpected side effects, especially with tailored data extractors.
>
> - `meta.schemes` is optional.
> - Properties can be nested indefinitely to follow RDF relationships.

### SemanticForm(s): Tailored data

Sometimes forms need to be enhanced with instance-specific business logic — for example, populating certain fields based on the currently logged-in organisation. This is supported through **tailored data extractors**.

> **Note:** This feature is still experimental. Use at your own discretion.

#### How to create tailored meta/source-data extractors

Navigate to the matching SemanticFormDirectory and create the following directories alongside `/versions`:

```shell
# custom metadata extractors
mkdir -p tailored/meta

# custom source-data extractors
mkdir -p tailored/source
```

Each directory should contain an `index.js` that exports an array of extractor functions. These are called when the service enhances a new form. They run in the order they are defined and have access to `rdflib`, `mu`, and sudo query utilities.

For a starter example, see `./example/tailored/` in this repository.

### [deprecated] ~~Mapper~~

At inception, submitted SemanticForms would be mapped to a pre-defined clean data model. This mapper could create new resources, copy fields, and establish relations between the form data and target model.

This functionality was removed after the responsibility was moved to other services in order to simplify the process.  
See [commit 945af4b](https://github.com/lblod/subsidy-applications-management-service/commit/945af4b7b7e388f139d51ffe9494edb1500e7bb9).

## Generates

### SemanticForm(s): MetaData

Metadata is the extra data a client needs to correctly render a form — concept labels, option lists, orderings, etc. It is derived from concept schemes defined in `config.json` and fetched from the triplestore.

**The service does not generate metadata on startup.** It starts generating once a client first requests a form that needs it.

#### Where and how is it stored?

All metadata is stored as Turtle files under `[META_DATA_ROOT](#environment-variables)`, mirroring the same folder structure as the matching SemanticFormDirectory.

#### Is the metadata kept up-to-date?

Yes. When a new form is requested, a background cron job is started to periodically check whether the metadata is still current. If it has changed in the triplestore, a new file is generated. The cron schedule is controlled by `[META_DATA_CRON](#environment-variables)`.

To avoid dangling background jobs, the cron is automatically stopped after `[META_DATA_STALE_CRON_STOP](#environment-variables)` days without a client request.

#### What if the triplestore is mid-migration?

To avoid writing stale metadata during active migrations, the service uses an **exponential backoff** strategy. If a change is detected during extraction, the service waits and retries. If the data keeps changing, it assumes an unstable state and backs off further until data stabilises or the maximum wait is reached. See `META_DATA_EXTRACTION_BACKOFF_`* environment variables.

## API

Each form instance has a lifecycle with three possible statuses:


| Status    | Meaning                                                 |
| --------- | ------------------------------------------------------- |
| `NEW`     | Form was just created, no data filled in yet            |
| `CONCEPT` | Form is in progress (partially filled)                  |
| `SENT`    | Form has been submitted — further mutations are blocked |


---

### Health check

> **GET** `/`

Returns a simple message confirming the service is running.

**Response:** `200 OK` — plain text greeting.

---

### Get the configuration and latest meta-data

> **GET** `/sources/latest?uri={formConfigurationUri}`

Returns the file references for the latest form specification and metadata associated with a given form configuration URI. Used by clients to discover which files they need to fetch in order to build a form.

**Query parameters:**


| Parameter | Required | Description                              |
| --------- | -------- | ---------------------------------------- |
| `uri`     | yes      | URI of the form configuration to look up |


**Response:** `200 OK`

```json
{
  "configuration": {
    "specification": "...",
    "tailored": {
      "meta": "...",
      "source": "..."
    }
  },
  "meta": "..."
}
```

**Status codes:**


| Code  | Reason                           |
| ----- | -------------------------------- |
| `200` | Success                          |
| `400` | `uri` query parameter is missing |
| `500` | Unexpected server error          |


---

### Get all the data needed to construct a semantic form

> **GET** `/semantic-forms/:uuid`

Returns everything a client needs to render a form: the SHACL form specification (Turtle), the current source data for the form instance (N-Triples), and the metadata for rendering option lists and labels (Turtle).

If the form is `NEW` or incomplete, the service will automatically enrich it with the latest sources before responding.

**Response:** `200 OK`

```json
{
  "form": "<turtle: form specification>",
  "source": "<n-triples: form instance data>",
  "meta": "<turtle: concept labels and option lists>"
}
```

**Status codes:**


| Code  | Reason                                                |
| ----- | ----------------------------------------------------- |
| `200` | Success                                               |
| `400` | Form not found or not accessible for the current user |
| `404` | No form with this UUID exists                         |
| `500` | Unexpected server error                               |


---

### Update the source-data based on a given delta

> **PUT** `/semantic-forms/:uuid`

Applies a delta to the form's source data in the triplestore. The client sends the triples to add and the triples to remove, both as N-Triples strings. This is how form field changes are persisted.

Mutations are **blocked** if the form has already been submitted (`SENT` status).

**Request body:**

```json
{
  "additions": "<n-triples to insert>",
  "removals": "<n-triples to delete>"
}
```

**Status codes:**


| Code  | Reason                                                 |
| ----- | ------------------------------------------------------ |
| `204` | Update applied successfully                            |
| `400` | Form not found or not accessible                       |
| `404` | No form with this UUID exists                          |
| `409` | Form is already submitted — no further changes allowed |
| `500` | Unexpected server error                                |


---

### Delete all the source-data for a semantic-form

> **DELETE** `/semantic-forms/:uuid`

Removes the form instance and all its associated source data from the triplestore.

Deletion is **blocked** if the form has already been submitted (`SENT` status).

**Status codes:**


| Code  | Reason                                    |
| ----- | ----------------------------------------- |
| `204` | Deleted successfully                      |
| `400` | Form not found or not accessible          |
| `404` | No form with this UUID exists             |
| `409` | Form is already submitted — cannot delete |
| `500` | Unexpected server error                   |


---

### Submit a semantic-form

> **POST** `/semantic-forms/:uuid/submit`

Validates the form against its SHACL specification and, if valid, marks it as submitted by setting its status to `SENT`. Once submitted, the form's data can no longer be modified or deleted.

**Status codes:**


| Code  | Reason                                                   |
| ----- | -------------------------------------------------------- |
| `204` | Submitted successfully                                   |
| `400` | Form not found or not accessible                         |
| `404` | No form with this UUID exists                            |
| `409` | Form is already submitted                                |
| `422` | Form failed SHACL validation — cannot be submitted as-is |
| `500` | Unexpected server error                                  |


---

### Sync all meta-data

> **GET** `/meta/sync`

Triggers an immediate metadata refresh for all configured SemanticFormSpecifications and returns the current metadata map keyed by form URI.

> **Warning:** This is a heavy request. It hits the triplestore for every configured form. Use it for administrative or debugging purposes, not as part of normal form rendering.

**Response:** `200 OK` — JSON object mapping form configuration URIs to their current metadata.

---

## Development

For a detailed guide on developing microservices with the mu-javascript-template, see [Developing with the template](https://github.com/mu-semtech/mu-javascript-template#developing-with-the-template).

### Developing in the `mu.semte.ch` stack

Paste the following snippet in your `docker-compose.override.yml`:

```yaml
subsidy-applications-management:
  image: semtech/mu-javascript-template:1.6.0
  ports:
    - 8888:80
    - 9229:9229
  environment:
    NODE_ENV: "development"
  volumes:
    - /absolute/path/to/your/sources/:/app/
```

### Development-only endpoints

When `NODE_ENV=development`, the following additional endpoints are available. They return `403 Forbidden` in any other environment.


| Endpoint                                                    | Description                                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /semantic-form/:uuid/source-data`                      | Extracts and returns the raw source data (N-Triples) for a form by UUID. Useful for inspecting what data a form currently holds.                               |
| `GET /meta/extract`                                         | Extracts metadata from the triplestore for the concept-scheme URIs provided in the request body (JSON array). Returns N-Triples.                               |
| `GET /meta/tailored/extract?uri={configUri}&form={formUri}` | Runs the tailored metadata extractors for a given form configuration and form instance URI. Returns the resulting delta. Useful for testing custom extractors. |


