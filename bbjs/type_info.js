/**
 * TypeInfo

Extract type information, including:
  - What types have been declared,
  - What types can be cast to which other types,
  - What methods are declared and what their return types are,
  - What attributes are declared and what their return types are.

Usage:
  var typeInfo = new TypeInfo();
  typeInfo.processAllModules(<Array of parsed Modules nodes>);

  ... query typeInfo ...

 */

var TypeInfo = exports.TypeInfo = (function() {
  "use strict";

  function TypeInfo() {
    this.classes = Object.create(null);

    // Variables that should be refreshed per Module.
    this.packge = null;
    this.aliases = null;
  }

  TypeInfo.prototype._getPackage = function() {
    if (!this.package) {
      throw new Error("getPackage -- package not defined");
    }
    return this.package;
  };

  TypeInfo.prototype._getFullTypename = function(typename) {
    if (this.aliases[typename]) {
      return this.aliases[typename];
    }
    return this._getPackage() + '.' + typename;
  };

  TypeInfo.prototype.processAllModules = function(modules) {
    var i;
    for (i = 0; i < modules.length; i++) {
      this._visit(modules[i]);
    }
  };

  TypeInfo.prototype._visit = function(node) {
    var methodName = '_visit' + node.type;
    if (this[methodName] === undefined) {
      throw new Error("TypeInfo has no method: " + methodName);
    }
    return this[methodName](node);
  };

  TypeInfo.prototype._visitModule = function(node) {
    var i;
    this.package = node.pkg;
    this.aliases = Object.create(null);
    for (i = 0; i < node.imports.length; i++) {
      this._visit(node.imports[i]);
    }
    for (i = 0; i < node.classes.length; i++) {
      this._visit(node.classes[i]);
    }
    this.package = null;
    this.aliases = null;
  };

  TypeInfo.prototype._visitImport = function(node) {
    // TODO
  };

  TypeInfo.prototype._visitClass = function(node) {
    // TODO
  };

  return TypeInfo;
})();


