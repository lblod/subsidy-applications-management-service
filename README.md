# subsidy-applications-management-service

Service that provides management off everything related to "subsidie aanvragen" forms

## Installation

To add the service to your `mu.semte.ch` stack, add the following snippet to docker-compose.yml:

```yaml
services:
  subsidy-applications-managment:
    image: lblod/subsidy-applications-management-service:x.x.x
```
## Configuration

### Environment variables


## API

## Development

For a more detailed look in how to develop a microservices based on the [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template),
we would recommend reading "[Developing with the template](https://github.com/mu-semtech/mu-javascript-template#developing-with-the-template)"

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
````
