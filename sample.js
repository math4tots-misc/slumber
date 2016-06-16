/* jshint esversion: 6 */
(function() {
"use strict";
let slnil;
let sltrue;
let slfalse;
let slprint;
let slObject;
let slClass;
let slModule;
let slNil;
let slBool;
let slNumber;
let slString;
let slList;
let slTable;
let slFunction;
let slError;
let Err;
let slPromise;
let loadModule;
let slxThrow;
let slxRun;
let checkargs;
let checkargsrange;
let checkargsmin;
let checktype;
let callm;
let getattr;
let setattr;
let makeString;
let makeNumber;
let MODULE_LOADERS = {
"core/prelude.js": function(exports) {
  let MODULE_CACHE = {};
  loadModule = function(uri) {
    if (!MODULE_CACHE[uri]) {
      MODULE_CACHE[uri] = new slxModule(uri, loadModuleRaw(uri));
    }
    return MODULE_CACHE[uri];
  };
  
  Err = class extends Error {
    constructor(message) {
      super(message);
      this.stacktrace = [];
    }
    toTraceMessage() {
      let message = '';
      for (let [uri, lineno, context] of this.stacktrace) {
        message += '\nFile "' + uri + '", line ' + lineno + ', in ' + context;
      }
      return message;
    }
    toString() {
      return super.toString() +
          '\n\n-- slumber trace --' + this.toTraceMessage() +
          '\n\n--- javascript trace ---\n' + this.stack;
    }
  };
  
  slxThrow = function(message) {
    throw new Err(message);
  };
  
  slxRun = function(frame, f) {
    let result = slnil;
    try {
      result = f();
    } catch(e) {
      if (e instanceof Err) {
        e.stacktrace.push(frame);
      }
      throw e;
    }
    return result;
  };
  
  checkargs = function(args, len) {
    if (args.length !== len) {
      slxThrow('expected ' + len + ' args but got ' + args.length);
    }
  };
  
  checkargsrange = function(args, a, b) {
    if (args.length < a || args.length > b) {
      slxThrow('expected ' + a + ' to ' + b + ' args but got ' + args.length);
    }
  };
  
  checkargsmin = function(args, min) {
    if (args.length < min) {
      slxThrow('expected at least ' + min + ' args but got ' + args.length);
    }
  };
  
  checktype = function(arg, t) {
    if (!arg.isA(t)) {
      slxThrow('expected ' + t.clsname + ' but got ' + arg.cls.clsname);
    }
  };
  
  callm = function(target, methodName, args) {
    if (!target[methodName]) {
      slxThrow(
          'No method named ' + methodName + ' in instance of type ' +
          target.cls.clsname);
    }
    let result = target[methodName](args);
    return result ? result : slnil;
  };
  
  getattr = function(target, attributeName) {
    if (!target.attrs[attributeName]) {
      slxThrow(
          'No attribute named ' + attributeName + ' in instance of type ' +
          target.cls.clsname);
    }
    return target.attrs[attributeName];
  };
  
  setattr = function(target, attributeName, value) {
    target.attrs[attributeName] = value;
    return value;
  };
  
  let objectCount = 0;
  
  class slxObject {
    constructor() {
      this.objid = objectCount++;
      this.attrs = {};
    }
    truthy() {
      return callm(this, 'sl__bool', []);
    }
    isA(cls) {
      return this instanceof cls.jscls;
    }
    // sl methods
    sl__init(args) {
      checkargs(args, 0);
    }
    sl__bool(args) {
      checkargs(args, 0);
    }
    sl__str(args) {
      checkargs(args, 0);
      return callm(this, 'sl__repr', []);
    }
    sl__repr(args) {
      checkargs(args, 0);
      return new slxString(
          '<' + this.cls.clsname + ' instance ' + this.objid + '>');
    }
  }
  
  
  class slxClass extends slxObject {
    constructor(clsname, jscls) {
      super();
      this.clsname = clsname;
      this.jscls = jscls;
      this.cls = this;
    }
    sl__call(args) {
      let instance = new this.jscl();
      instance.cls = this;
      callm(instance, 'sl__init', args);
      return instance;
    }
  }
  
  slxObject.prototype.cls = slObject = new slxClass('Object', slxObject);
  slxClass.prototype.cls = slClass = new slxClass('Class', slxClass);
  
  class slxModule extends slxObject {
    constructor(uri, contents) {
      super();
      this.uri = uri;
      this.contents = contents;
      for (var key of Object.getOwnPropertyNames(contents)) {
        this[key] = contents[key];
      }
    }
  }
  slxModule.prototype.cls = slModule = new slxClass('Module', slxModule);
  
  class slxNil extends slxObject {
  }
  slxNil.prototype.cls = slNil = new slxClass('Nil', slxNil);
  slnil = new slxNil();
  
  class slxBool extends slxObject {
    constructor(dat) {
      super();
      this.dat = dat;
    }
    sl__repr(args) {
      checkargs(args, 0);
      return new slxString(this.dat ? 'true' : 'false');
    }
  }
  slxBool.prototype.cls = slBool = new slxClass('Bool', slxBool);
  sltrue = new slxBool(true);
  slfalse = new slxBool(false);
  
  class slxNumber extends slxObject {
    constructor(dat) {
      super();
      this.dat = dat;
    }
    sl__repr(args) {
      checkargs(args, 0);
      return new slxString(this.dat.toString());
    }
    sl__add(args) {
      checkargs(args, 1);
      checktype(args[0], slNumber);
      return new slxNumber(this.dat + args[0].dat);
    }
  }
  slxNumber.prototype.cls = slNumber = new slxClass('Number', slxNumber);
  
  makeNumber = function(dat) {
    return new slxNumber(dat);
  };
  
  class slxString extends slxObject {
    constructor(dat) {
      super();
      this.dat = dat;
    }
    sl__str(args) {
      checkargs(args, 0);
      return this;
    }
    sl__add(args) {
      checkargs(args, 1);
      checktype(args[0], slString);
      return new slxString(this.dat + args[0].dat);
    }
  }
  slxString.prototype.cls = slString = new slxClass('String', slxString);
  
  makeString = function(string) {
    return new slxString(string);
  };
  
  
  class slxFunction extends slxObject {
    constructor(fname, dat) {
      super();
      this.fname = fname;
      this.dat = dat;
    }
    sl__call(args) {
      let result = this.dat(args);
      return result ? result : slnil;
    }
  }
  slxFunction.prototype.cls = slFunction = new slxClass('Function', slxFunction);
  slprint = new slxFunction('print', function(args) {
    checkargs(args, 1);
    console.log(callm(args[0], 'sl__str', []).dat);
  });
  
  
  
  return exports;
},
"core/prelude.sl": function(exports) {
  {
  slxRun(["core/prelude.sl", 1, "<module>"], function(){return loadModule("core/prelude.js"); });}
  return exports;
},
"sample.sl": function(exports) {
  let slx = slnil;
  {
  slxRun(["sample.sl", 1, "<module>"], function(){return callm(slprint, "sl__call", [makeString("hello world!")]); });
  slxRun(["sample.sl", 2, "<module>"], function(){return callm(slprint, "sl__call", [callm(makeNumber(5), "sl__add", [makeNumber(6)])]); });
  slxRun(["sample.sl", 3, "<module>"], function(){return (slx = makeNumber(7)); });
  slxRun(["sample.sl", 4, "<module>"], function(){return callm(slprint, "sl__call", [callm(makeNumber(7), "sl__add", [makeNumber(6)])]); });
  slxRun(["sample.sl", 5, "<module>"], function(){return callm(slprint, "sl__call", [callm(makeString("hey "), "sl__add", [makeString("there")])]); });}
  exports.slx = slx;
  return exports;
},
};
let LOADED_MODULES = {};
function loadModuleRaw(uri) {
  if (!LOADED_MODULES[uri]) {
    if (!MODULE_LOADERS[uri]) {
      throw new Error('No such module ' + uri);
    }
    let module = LOADED_MODULES[uri] = {};
    MODULE_LOADERS[uri](module);
  }
  return LOADED_MODULES[uri];
}
function catchAndDisplay(f) {
  try {
    f();
  } catch (e) {
    if (e instanceof Err) {
      console.log(e.toString());
    } else {
      throw e;
    }
  }
}
catchAndDisplay(function() {
  loadModuleRaw("core/prelude.js");
  loadModuleRaw("core/prelude.sl");
  loadModuleRaw("sample.sl");
});
})();
