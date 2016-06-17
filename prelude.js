/* jshint esversion: 6 */

// let slTable;
// let slPromise;

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
      e2.stack = e.stack;
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
        'No method named "' + methodName.slice(2) +
        '" in instance of type ' + target.cls.clsname);
  }
  let result = target[methodName](args);
  return result ? result : slnil;
}

function getattr(target, attributeName) {
  if (!target.attrs[attributeName]) {
    slxThrow(
        'No attribute named "' + attributeName.slice(2) +
        '" in instance of type ' + target.cls.clsname);
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
    return callm(this, 'sl__bool', []).truthy();
  }
  isA(cls) {
    return this instanceof cls.jscls;
  }
  [Symbol.iterator]() {
    return callm(this, 'sl__iter', []);
  }
  next() {
    if (callm(this, 'sl__more', []).truthy()) {
      return {done: false, value: callm(this, 'sl__next', [])};
    } else {
      return {done: true};
    }
  }
  toString() {
    let result = callm(this, 'sl__str', []);
    if (!(result instanceof slxString)) {
      slxThrow('__str returned a non-string');
    }
    return result.dat;
  }
  // sl methods
  sl__init(args) {
    checkargs(args, 0);
  }
  sl__eq(args) {
    checkargs(args, 1);
    return this === args[0];
  }
  sl__ne(args) {
    checkargs(args, 1);
    return callm(this, 'sl__eq', args).truthy() ? slfalse : sltrue;
  }
  sl__bool(args) {
    checkargs(args, 0);
    return sltrue;
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
  sl__iter(args) {
    checkargs(args, 0);
    slxThrow('instance of ' + this.cls.clsname + ' is not iterable');
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
    let instance = new this.jscls();
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
  truthy() {
    return this.dat;
  }
  sl__bool(args) {
    return this;
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
  sl__eq(args) {
    checkargs(args, 1);
    return (
        args[0] instanceof slxNumber && args[0].dat === this.dat ?
        sltrue : slfalse);
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
  sl__eq(args) {
    checkargs(args, 1);
    return (
        args[0] instanceof slxString && args[0].dat === this.dat ?
        sltrue : slfalse);
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

class slxList extends slxObject {
  constructor(dat) {
    super();
    this.dat = dat;
  }
  checkindex(i) {
    if (i !== Math.floor(i)) {
      slxThrow('Index is not an integer i = ' + i);
    }
    let xs = this.dat;
    if (i < 0 || i >= xs.length) {
      slxThrow('Indexed list out of bounds i = ' + i + 'len = ' + xs.length);
    }
  }
  sl__init(args) {
    checkargs(args, 1);
    this.dat = Array.from(args[0]);
  }
  sl__len(args) {
    checkargs(args, 0);
    return new slxNumber(this.dat.length);
  }
  sl__getitem(args) {
    checkargs(args, 1);
    checktype(args[0], slNumber);
    this.checkindex(args[0].dat);
    return this.dat[args[0].dat];
  }
  sl__setitem(args) {
    checkargs(args, 2);
    checktype(args[0], slNumber);
    this.checkindex(args[0].dat);
    return (this.dat[args[0]] = args[1]);
  }
  sl__eq(args) {
    checkargs(args, 1);
    if (!(args[0] instanceof slxList)) {
      return slfalse;
    }
    let xs = this.dat, ys = args[0].dat;
    if (xs.length !== ys.length) {
      return slfalse;
    }
    for (let i = 0; i < xs.length; i++) {
      if (!callm(xs[i], 'sl__eq', [ys[i]]).truthy()) {
        return slfalse;
      }
    }
    return sltrue;
  }
  sl__iter(args) {
    return new slxGeneratorObject('__iter', (function* gen() {
      for (let x of this.dat) {
        yield x;
      }
    }).apply(this));
  }
  sl__repr(args) {
    checkargs(args, 0);
    let r = '[';
    let comma = false;
    for (let x of this.dat) {
      if (comma) {
        r += ', ';
      }
      r += x.toString();
      comma = true;
    }
    r += ']';
    return new slxString(r);
  }
  slpush(args) {
    checkargs(args, 1);
    this.dat.push(args[0]);
  }
}
let slList = slxList.prototype.cls = new slxClass('List', slxList);

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
let sliter = new slxFunction('iter', function(args) {
  checkargs(args, 1);
  return callm(args[0], 'sl__iter', []);
});
let sllen = new slxFunction('len', function(args) {
  checkargs(args, 1);
  return callm(args[0], 'sl__len', []);
});
let slrepr = new slxFunction('repr', function(args) {
  checkargs(args, 1);
  return callm(args[0], 'sl__repr', []);
});
let slassert = new slxFunction('assert', function(args) {
  checkargsrange(args, 1, 2);
  if (!args[0].truthy()) {
    let message = args[1] ? args[1].toString() : 'assertion failed';
    slxThrow(message);
  }
});
let sladdMethodTo = new slxFunction('addMethodTo', function(args) {
  checkargs(args, 1);
  checktype(args[0], slClass);
  let cls = args[0];
  return new slxFunction('addMethodTo.<wrapper>', function(args) {
    checkargs(args, 1);
    let f;
    if (args[0].isA(slGenerator)) {
      f = function() {
        return new slxGeneratorObject(args[0].fname, args[0].dat.apply(this));
      };
    } else {
      checktype(args[0], slFunction);
      f = args[0].dat;
    }
    cls.jscls.prototype['sl' + args[0].fname] = args[0].dat;
  });
});

class slxGenerator extends slxObject {
  constructor(fname, dat) {
    super();
    this.fname = fname;
    this.dat = dat;
  }
  sl__call(args) {
    return new slxGeneratorObject(this.fname, this.dat(args));
  }
}
let slGenerator = slxGenerator.prototype.cls = new slxClass(
    'Generator', slxGenerator);

class slxGeneratorObject extends slxObject {
  constructor(fname, dat) {
    super();
    this.fname = fname;
    this.dat = dat;
    this.peek = dat.next();
  }
  sl__iter(args) {
    checkargs(args, 0);
    return this;
  }
  sl__more(args) {
    checkargs(args, 0);
    return this.peek.done ? slfalse : sltrue;
  }
  sl__next(args) {
    checkargs(args, 0);
    if (this.peek.done) {
      slxThrow('Tried to call __next on a finished generator object');
    }
    let ret = this.peek.value;
    this.peek = this.dat.next();
    return ret;
  }
}

let slGeneratorObject = slxGeneratorObject.prototype.cls = new slxClass(
    'GeneratorObject', slxGeneratorObject);
