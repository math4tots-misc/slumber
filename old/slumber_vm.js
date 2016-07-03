/* jshint esversion: 6 */

let vmSlumber;

if (typeof module !== 'undefined' && module.exports) {
  vmSlumber = module.exports;
} else {
  vmSlumber = {};
}

(function(exports) {
"use strict";

let parser;
if (typeof module !== 'undefined' && module.exports) {
  parser = require('./slumber_parser.js');
} else {
  parser = slumberParser;
}


////// everything above this point is for importing modules
////// -- trying to make it work for both node.js and browser.

(function() {

const OP_NOP = 0;
const OP_LITERAL = 1;
const OP_LOOKUP_VARIABLE = 2;

class Context {
  constructor(scope, opcodes, data, tokens) {
    this.scop = scope;
    this.opcodes = opcodes;
    this.dat = data;
    this.tokens = tokens;
    this.i = 0;
    this.valueStack = [];
  }

  step() {
    const i = this.i;
    const opcode = this.opcodes[i];
    const scope = this.scop;
    const dat = this.dat[i];
    switch (opcode) {
    case OP_NOP:
      this.i++;
      break;
    case OP_LITERAL:
      this.valueStack.push(dat);
      this.i++;
      break;
    case OP_LOOKUP_VARIABLE:
      const val = scope[dat];
      if (val === undefined) {
        throw new SlumberError('Name not defined: ' + dat, this.tokens[i]);
      }
      this.valueStack.push(val);
      this.i++;
      break;
    default:
      throw new SlumberError('Invalid opcode: ' + opcode, this.tokens[i]);
    }
  }
}

class Compiler {
  visit(node) {
    
  }
}

})();

})(vmSlumber);

