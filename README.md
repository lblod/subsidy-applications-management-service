# subsidy-applications-management-service

Service that provides management related to subsidy-applications (subsidie aanvragen) semantic forms.

This includes but is not limited to:
- providing all the (meta)data needed to construct a semantic form
- updating and deleting source-data

## Installation

To add the service to your `mu.semte.ch` stack, add the following snippet to docker-compose.yml:

```yaml
services:
  subsidy-applications-management:
    image: lblod/subsidy-applications-management-service:x.x.x
    volumes:
      - ./config/semanctic-form-path:/share
```
> **NOTE**: Make sure to mount `/share` as this folder should contain the configuration for this service to work correctly

## Configuration

### The `/share` volume

### Configuration file `config.json`

This `json` file contains static-data to be used by the service.

#### Properties:

- **application-form**: Contains all static-data related to the construction off the source-data for an application-form
    - **prefixes**: collection of prefixes to be used when generating the queries
    - **paths**: paths to be included in the source-data
        - *best practice to include atleast the uuid and type*
    
#### Example:

```json
{
  "application-form": {
    "prefixes": [
      "PREFIX mu: <http://mu.semte.ch/vocabularies/core/>",
      "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
      "PREFIX dct: <http://purl.org/dc/terms/>",
      "PREFIX skos: <http://www.w3.org/2004/02/skos/core#>"
    ],
    "paths": [
      "rdf:type",
      "mu:uuid",
      "dct:source",
      "skos:prefLabel"
    ]
  }
}
```
    
### Semantic Form configuration files

Within this folder you can drop the `.ttl` semantic form configuration files.

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


### Environment variables

| Name                      | Description                                           | Default               |
|---------------------------|-------------------------------------------------------|-----------------------|
|       `ACTIVE_FORM`       |       The active form/form-data turtle filename.      |       `form.ttl`      |

## API

### Get the current active form file.

> **GET** `/active-form-file`

```
HTTP/1.1 
200 OK
X-Powered-By: Express
content-type: application/json; charset=utf-8
Date: Tue, 17 Nov 2020 08:47:01 GMT

{
  type: "form-file",
  id: "1",
  attributes: {
    uri: "/share/example-form-uri.ttl",
  }
}
```

### Get all the meta(data) needed to construct a semantic form for an application-form.

> **GET** `/application-forms/:uuid`

#### Response

```
HTTP/1.1 
200 OK
X-Powered-By: Express
content-type: application/json; charset=utf-8
Date: Tue, 17 Nov 2020 08:47:01 GMT

{
  "form": "",
  "source": ""
}
```

### Update the source-data based on a given delta for an application-form

> **PUT** `/application-forms/:uuid`

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

### Delete all the source-data for an application-form

> **DELETE** `/application-forms/:uuid`

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
