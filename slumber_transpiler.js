/* jshint esversion: 6 */

let parser = require('./slumber_parser.js');


class Transpiler {
  constructor(environment) {
    this.environment = environment;
    this.loaded = new Set();
    this.loading = new Set();
  }

  transpile(uri) {
    let data = this.environment.loadUri(uri);
  }

  visit(node) {
    return node.accep(this);
  }

  visitFileInput(node) {
  }
}


class DefaultTranspilerEnvironment {
}


function transpile(uri, environment) {
  if (environment === undefined) {
    environment = new DefaultTranspilerEnvironment();
  }
  return new Transpiler(environment).transpile(uri);
}

exports.transpile = transpile;
