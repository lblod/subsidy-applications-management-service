module.exports = {
  name: 'example-tailored-meta-data-extractor', // NOTE: used for debugging
  execute: async (store, graphs, lib) => {
    /**
     * Sadly for now we need to pre-define libraries that can be used. The following are available:
     *  - $rdf => rdflib.js
     *  - mu => mu-javascript-template mu lib.
     *  - sudo => mu-sudo
     */
    const {$rdf, mu, sudo} = lib;
    /**
     * You can do whatever magic you want here! Just ensure you put your tailored meta-data in the right graph:
     *  - `graphs.additions` for additions
     *  - `graphs.removals` for removals
     */
    const DCT = $rdf.Namespace('http://purl.org/dc/terms/');
    store.add($rdf.sym('http://mu.semte.ch/resource/ships/NCC-1701'), DCT('title'), 'Enterprise', graphs.additions);
  },
};