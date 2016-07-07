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

  function isPrimitive(typename) {
    return (
        typename === 'void' ||
        typename === 'bool' ||
        typename === 'int' ||
        typename === 'float');
  }

  function argTypesAreEqual(argtypes1, argtypes2) {
    var i, len;
    if (argtypes1.length !== argtypes2.length) {
      return false;
    }
    for (i = 0, len = argtypes1.length; i < len; i++) {
      if (argtypes1[i] !== argtypes2[i]) {
        return false;
      }
    }
    return true;
  }

  function TypeInfo() {
    this.classes = Object.create(null);
  }

  TypeInfo.prototype.processAllModules = function(modules) {
    var i, key;
    for (i = 0; i < modules.length; i++) {
      this._visit(modules[i]);
    }
    for (key in this.classes) {
      this._processClassInheritance(key);
    }
  };

  TypeInfo.prototype._processClassInheritance = function(className) {
    var klass = this.classes[className], baseName, base, subBaseName;
    var newSupers, attrName, methodName;
    if (klass === undefined) {
      throw new Error("Class " + className + " does not exist");
    }
    if (klass.processed) {
      return;
    }
    klass.processed = true;
    for (baseName in klass.supers) {
      this._processClassInheritance(baseName);
    }
    newSupers = Object.create(null);
    newSupers[className] = true;
    for (baseName in klass.supers) {
      base = this._getClassFromName(baseName);
      for (subBaseName in base.supers) {
        newSupers[subBaseName] = true;
      }
      for (attrName in base.attributeTypes) {
        if (klass.attributeTypes[attrName]) {
          throw new Error("Clashing " + className + "." + attrName +
                          " attribute definition in inheritance tree");
        }
        klass.attributeTypes[attrName] = base.attributeTypes[attrName];
      }
      for (methodName in base.methodReturnType) {
        if (klass.methodReturnType[methodName]) {
          if ((klass.methodReturnType[methodName] !==
               base.methodReturnType[methodName]) ||
              !argTypesAreEqual(
                  klass.methodArgTypes[methodName],
                  base.methodArgTypes[methodName])) {
            throw new Error("Clashing method definition for " +
                            className + "." + methodName + " -- " +
                            " in order to override a function type " +
                            "signatures must be identical");
          }
        } else {
          klass.methodReturnType[methodName] =
              base.methodReturnType[methodName];
          klass.methodArgTypes[methodName] = base.methodArgTypes[methodName];
        }
      }
    }
    klass.supers = newSupers;
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
    for (i = 0; i < node.classes.length; i++) {
      this._visit(node.classes[i]);
    }
  };

  TypeInfo.prototype._visitClass = function(node) {
    var i, that = this;
    var klass = Object.create(null);
    var className = node.fullName;
    klass.name = className;
    klass.supers = Object.create(null);
    if (node.base === null) {
      if (className !== 'bb.lang.Object') {
        klass.supers['bb.lang.Object'] = true;
      }
    } else {
      klass.supers[node.base.fullName] = true;
    }
    for (i = 0; i < node.interfaces.length; i++) {
      klass.supers[node.interfaces[i].fullName] = true;
    }
    klass.staticAttributeTypes = Object.create(null);
    klass.attributeTypes = Object.create(null);
    for (i = 0; i < node.attrs.length; i++) {
      if (node.attrs[i].isStatic) {
        if (klass.staticAttributeTypes[node.attrs[i].name]) {
          throw new Error(className + "." + node.attrs[i].name + " has " +
                          "duplicate definition");
        }
        klass.staticAttributeTypes[node.attrs[i].name] =
            node.attrs[i].cls.fullName;
      } else {
        if (klass.attributeTypes[node.attrs[i].name]) {
          throw new Error(className + "." + node.attrs[i].name + " has " +
                          "duplicate definition");
        }
        klass.attributeTypes[node.attrs[i].name] =
            node.attrs[i].cls.fullName;
      }
    }
    klass.staticMethodReturnType = Object.create(null);
    klass.methodReturnType = Object.create(null);
    klass.staticMethodArgTypes = Object.create(null);
    klass.methodArgTypes = Object.create(null);
    function extractTypeFromTypeArgPair(typeArgPair) {
      return typeArgPair[0].fullName;
    }
    for (i = 0; i < node.methods.length; i++) {
      if (node.methods[i].isStatic) {
        if (klass.staticMethodReturnType[node.methods[i].name]) {
          throw new Error(className + "." + node.methods[i].name + " has " +
                          "duplicate definition");
        }
        klass.staticMethodReturnType[node.methods[i].name] =
            node.methods[i].returns.fullName;
        klass.staticMethodArgTypes[node.methods[i].name] =
            node.methods[i].args.map(extractTypeFromTypeArgPair);
      } else {
        if (klass.methodReturnType[node.methods[i].name]) {
          throw new Error(className + "." + node.methods[i].name + " has " +
                          "duplicate definition");
        }
        klass.methodReturnType[node.methods[i].name] =
            node.methods[i].returns.fullName;
        klass.methodArgTypes[node.methods[i].name] =
            node.methods[i].args.map(extractTypeFromTypeArgPair);
      }
    }
    klass.processed = false;
    this.classes[className] = klass;
  };

  TypeInfo.prototype._getClassFromName = function(className) {
    var klass = this.classes[className];
    if (!klass) {
      throw new Error("Class " + className + " doesn't exist");
    }
    return klass;
  };

  TypeInfo.prototype.classExists = function(className) {
    return isPrimitive(className) || !!this.classes[className];
  };

  TypeInfo.prototype.isSubclass = function(subclassName, className) {
    if (isPrimitive(subclassName)) {
      return subclassName === className;
    }
    return !!this._getClassFromName(subclassName).supers[className];
  };

  TypeInfo.prototype.getAttributeType = function(className, attributeName) {
    var klass = this._getClassFromName(className);
    var type = klass.attributeTypes[attributeName];
    if (!type) {
      throw new Error("Attribute " + className + '.' + attributeName +
                      " doesn't exist");
    }
    return type;
  };

  TypeInfo.prototype.getStaticAttributeType = function(
      className, attributeName) {
    var klass = this._getClassFromName(className);
    var type = klass.staticAttributeTypes[attributeName];
    if (!type) {
      throw new Error("Static attribute " + className + '.' + attributeName +
                      " doesn't exist");
    }
    return type;
  };

  TypeInfo.prototype.getMethodType = function(className, methodName) {
    var klass = this._getClassFromName(className);
    var type = klass.methodReturnType[methodName];
    if (!type) {
      throw new Error("Method " + className + '.' + methodName +
                      " doesn't exist");
    }
    return type;
  };

  TypeInfo.prototype.getStaticMethodType = function(className, methodName) {
    var klass = this._getClassFromName(className);
    var type = klass.staticMethodReturnType[methodName];
    if (!type) {
      throw new Error("Static method " + className + '.' + methodName +
                      " doesn't exist");
    }
    return type;
  };

  TypeInfo.prototype.getMethodArgTypes = function(className, methodName) {
    var klass = this._getClassFromName(className);
    var types = klass.methodArgTypes[methodName];
    if (!types) {
      throw new Error("Method " + className + '.' + methodName +
                      " doesn't exist");
    }
    return types;
  };

  TypeInfo.prototype.getStaticMethodArgTypes = function(
      className, methodName) {
    var klass = this._getClassFromName(className);
    var types = klass.staticMethodArgTypes[methodName];
    if (!types) {
      throw new Error("Static method " + className + '.' + methodName +
                      " doesn't exist");
    }
    return types;
  };


  return TypeInfo;
})();


