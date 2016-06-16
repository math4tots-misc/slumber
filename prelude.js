/* jshint esversion: 6 */

// let slnil;
// let sltrue;
// let slfalse;
// let slprint;
// let slObject;
// let slClass;
// let slModule;
// let slNil;
// let slBool;
// let slNumber;
// let slString;
// let slList;
// let slTable;
// let slFunction;
// let slError;
// let Err;
// let slPromise;
// let loadModule;
// let slxThrow;
// let slxRun;
// let checkargs;
// let checkargsrange;
// let checkargsmin;
// let checktype;
// let callm;
// let getattr;
// let setattr;

let MODULE_CACHE = {};
function loadModule(uri) {
  if (!MODULE_CACHE[uri]) {
    MODULE_CACHE[uri] = new slxModule(uri, loadModuleRaw(uri));
  }
  return MODULE_CACHE[uri];
}

class Err extends Error {
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
}

function slxThrow(message) {
  throw new Err(message);
}

function slxRun(frame, f) {
  let result = slnil;
  try {
    result = f();
  } catch(e) {
    if (e instanceof Err) {
      e.stacktrace.push(frame);
    } else {
      let e2 = new Err(e);
      e2.stacktrace.push(frame);
      throw e2;
    }
    throw e;
  }
  return result;
}

function checkargs(args, len) {
  if (args.length !== len) {
    slxThrow('expected ' + len + ' args but got ' + args.length);
  }
}

function checkargsrange(args, a, b) {
  if (args.length < a || args.length > b) {
    slxThrow('expected ' + a + ' to ' + b + ' args but got ' + args.length);
  }
}

function checkargsmin(args, min) {
  if (args.length < min) {
    slxThrow('expected at least ' + min + ' args but got ' + args.length);
  }
}

function checktype(arg, t) {
  if (!arg.isA(t)) {
    slxThrow('expected ' + t.clsname + ' but got ' + arg.cls.clsname);
  }
}

function callm(target, methodName, args) {
  if (!target[methodName]) {
    slxThrow(
        'No method named ' + methodName + ' in instance of type ' +
        target.cls.clsname);
  }
  let result = target[methodName](args);
  return result ? result : slnil;
}

function getattr(target, attributeName) {
  if (!target.attrs[attributeName]) {
    slxThrow(
        'No attribute named ' + attributeName + ' in instance of type ' +
        target.cls.clsname);
  }
  return target.attrs[attributeName];
}

function setattr(target, attributeName, value) {
  target.attrs[attributeName] = value;
  return value;
}

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

let slObject = slxObject.prototype.cls = new slxClass('Object', slxObject);
let slClass = slxClass.prototype.cls = new slxClass('Class', slxClass);

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
let slModule = slxModule.prototype.cls = new slxClass('Module', slxModule);

class slxNil extends slxObject {
}
let slNil = slxNil.prototype.cls = new slxClass('Nil', slxNil);
let slnil = new slxNil();

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
let slBool = slxBool.prototype.cls = new slxClass('Bool', slxBool);
let sltrue = new slxBool(true);
let slfalse = new slxBool(false);

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
  sl__mul(args) {
    checkargs(args, 1);
    checktype(args[0], slNumber);
    return new slxNumber(this.dat * args[0].dat);
  }
  sl__lt(args) {
    checkargs(args, 1);
    checktype(args[0], slNumber);
    return this.dat < args[0].dat ? sltrue : slfalse;
  }
}
let slNumber = slxNumber.prototype.cls = new slxClass('Number', slxNumber);

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
let slString = slxString.prototype.cls = new slxClass('String', slxString);

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
let slFunction = slxFunction.prototype.cls = new slxClass('Function', slxFunction);
let slprint = new slxFunction('print', function(args) {
  checkargs(args, 1);
  console.log(callm(args[0], 'sl__str', []).dat);
});


