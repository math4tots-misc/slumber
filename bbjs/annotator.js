/**
 * annotator.js

The Annotator uses the information from a TypeInfo instance to
annotate the expressions in a parse tree with full typenames.

*/

var Annotator = exports.Annotator = (function() {
  "use strict";

  function Annotator(typeInfo) {
    this.typeInfo = typeInfo;
    this.varTypeStack = [];
    this.varTypes = Object.create(null);
  }

  Annotator.prototype._pushScope = function() {
    this.varTypeStack.push(this.varTypes);
    this.varTypes = Object.create(this.varTypes);
  };

  Annotator.prototype._popScope = function() {
    this.varTypes = this.varTypeStack.pop();
  };

  Annotator.prototype.declareVariable = function(type, name) {
    this.varTypes[name] = type;
  };

  Annotator.prototype.annotate = function(node) {
    this._visit(node);
  };

  Annotator.prototype._visit = function(node) {
    var methodName = '_visit' + node.type;
    if (this[methodName] === undefined) {
      throw new Error("Annotator has no method: " + methodName);
    }
    return this[methodName](node);
  };

  Annotator.prototype._visitModule = function(node) {
    var i;
    for (i = 0; i < node.classes.length; i++) {
      this._visit(node.classes[i]);
    }
  };

  Annotator.prototype._visitClass = function(node) {
    var i;
    for (i = 0; i < node.methods.length; i++) {
      this._visit(node.methods[i]);
    }
  };

  Annotator.prototype._visitMethod = function(node) {
    var i;
    this._pushScope();
    for (i = 0; i < node.args.length; i++) {
      this.declareVariable(node.args[i][0], node.args[i][1]);
    }
    this._visit(node.body);
    this._popScope();
  };

  Annotator.prototype._visitBlock = function(node) {
    var i;
    this._pushScope();
    for (i = 0; i < node.stmts.length; i++) {
      this._visit(node.stmts[i]);
    }
    this._popScope();
  };

  Annotator.prototype._visitMethodCall = function(node) {
    var i;
    this._visit(node.owner);
    for (i = 0; i < node.args.length; i++) {
      this._visit(node.args[i]);
    }
    node.exprType = this.typeInfo.getMethodType(
        node.owner.exprType, node.name);
  };

  Annotator.prototype._visitInt = function(node) {
    node.exprType = 'int';
  };

  return Annotator;
})();

