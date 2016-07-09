/* jshint esversion: 6 */
(function() {
"use strict";

class Source {
  constructor(code, uri) {
    this.code = code;
    this.uri = uri;
    Object.freeze(this);
  }
}

const KEYWORDS = {
  package: true,
  native: true,
  class: true,
  interface: true,
  extends: true,
  implements: true,
  return: true,

  // reserved words
    // Just because they are so loaded in other languages
    goto: true,
    new: true,
    // potential future primitive types
    list: true,
};

const ESCAPE_TABLE = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  "'": "'",
};

const REVERSE_ESCAPE_TABLE = Object.create(null);
for (const key in ESCAPE_TABLE) {
  REVERSE_ESCAPE_TABLE[ESCAPE_TABLE[key]] = key;
}

const SYMBOLS = [
  '{', '}', '(', ')', '[', ']', ';',
  '.', '=',
  '+', '++', '-', '--',
].sort().reverse();

function sanitizeString(str) {
  let newstr = '';
  for (const c of str) {
    if (REVERSE_ESCAPE_TABLE[c]) {
      newstr += REVERSE_ESCAPE_TABLE[c];
    } else {
      newstr += c;
    }
  }
  return newstr;
}

function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' ||
         ch === '\v';
}

const PRIMITIVE_TABLE = {
  void: 'Void', bool: 'Bool', float: 'Float', int: 'Int', string: 'String',
};

function isPrimitive(str) {
  return !!PRIMITIVE_TABLE[str];
}

function getWrapperType(prim) {
  if (!PRIMITIVE_TABLE[prim]) {
    throw new Error(prim + " is not a primitive type");
  }
  return PRIMITIVE_TABLE[prim];
}

function isWrapperTypeFor(type, prim) {
  return PRIMITIVE_TABLE[prim] === type;
}

function isTypename(str) {
  return isPrimitive(str) ||
         /[A-Z]/.test(str[0]) && (str.length === 1 || /[a-z]/.test(str));
}

function isName(str) {
  return /^[A-Za-z_0-9$]+$/.test(str);
}

function isDigit(str) {
  return /^[0-9]+$/.test(str);
}

class Token {
  constructor(source, pos, type, val) {
    this.source = source;
    this.pos = pos;
    this.type = type;
    this.val = val;
    Object.freeze(this);
  }
  inspect() {
    return "Token(" + this.type + ", " + this.val + ")";
  }
  toString() {
    return this.inspect();
  }
}

class Lexer {
  constructor(source) {
    if (!(source instanceof Source)) {
      throw new Error(source);
    }
    this._source = source;
    this._code = source.code;
    this._pos = 0;
    this._peek = this._extract();
  }
  peek() {
    return this._peek;
  }
  next() {
    const token = this._peek;
    this._peek = this._extract();
    return token;
  }
  _chpos(pos) {
    return pos < this._code.length ? this._code[pos] : '';
  }
  _ch(df) {
    if (df === undefined) { df = 0; }
    return this._chpos(this._pos + df);
  }
  _startsWith(prefix) {
    return this._code.startsWith(prefix, this._pos);
  }
  _skipSpacesAndComments() {
    while (true) {
      while (isSpace(this._ch())) {
        this._pos++;
      }
      if (this._ch() === '/*') {
        while (!this._startsWith('*/')) {
          if (this._ch() === '') {
            throw new Error("Multiline comment wasn't terminated!");
          }
          this._pos++;
        }
        continue;
      }
      if (this._ch() === '#' || this._startsWith('//')) {
        while (this._ch() !== '' && this._ch() !== '\n') {
          this._pos++;
        }
        continue;
      }
      break;
    }
  }
  _extract() {
    this._skipSpacesAndComments();
    if (this._ch() === '') {
      return new Token(this._source, this._pos, "EOF");
    }
    let start = this._pos;
    // STR
    if (this._startsWith('r"') || this._startsWith('"') ||
        this._startsWith("r'") || this._startsWith("'")) {
      let raw = false;
      if (this._ch() === 'r') {
        this._pos++;
        this.raw = true;
      }
      let q = this._ch();
      if (this._startsWith(q + q + q)) {
        q = q + q + q;
      }
      this._pos += q.length;
      let content = '';
      while (!this._startsWith(q)) {
        if (this._ch() === '') {
          throw new Error('Expected more string but found EOF');
        }
        if (!raw && this._ch() === '\\') {
          this._pos++;
          content += ESCAPE_TABLE[this._ch()];
          this._pos++;
        } else {
          content += this._ch();
          this._pos++;
        }
      }
      this._pos += q.length;
      return new Token(this._source, start, "STR", content);
    }
    // INT/FLOAT
    while (isDigit(this._ch())) {
      this._pos++;
    }
    if (this._ch() === '.') {
      this._pos++;
    }
    while (isDigit(this._ch())) {
      this._pos++;
    }
    const numstr = this._code.slice(start, this._pos);
    if (numstr.length > 0 && numstr !== '.') {
      if (numstr.indexOf('.') !== -1) {
        return new Token(this._source, start, "FLOAT", numstr);
      } else {
        return new Token(this._source, start, "INT", numstr);
      }
    }
    this._pos = start;
    // NAME/TYPENAME/KEYWORD
    while (isName(this._ch())) {
      this._pos++;
    }
    if (this._pos > start) {
      const str = this._code.slice(start, this._pos);
      if (KEYWORDS[str]) {
        return new Token(this._source, start, str);
      } else if (isTypename(str)) {
        return new Token(this._source, start, "TYPENAME", str);
      } else {
        return new Token(this._source, start, "NAME", str);
      }
    }
    // SYMBOL
    for (let symbol of SYMBOLS) {
      if (this._startsWith(symbol)) {
        this._pos += symbol.length;
        return new Token(this._source, start, symbol);
      }
    }
    // ERROR
    let content = '';
    while (this._ch() !== '' && !isSpace(this._ch())) {
      content += this._ch();
      this._pos++;
    }
    throw new Error("Invalid token: " + content);
  }
}

{
  const source = new Source('hello world "hi" 5 5.5 class --', 'uri');
  const lexer = new Lexer(source);
  const tokens = [];
  while (lexer.peek().type !== 'EOF') {
    tokens.push(lexer.next());
  }
  if (tokens.toString() !==
      "Token(NAME, hello),Token(NAME, world),Token(STR, hi)," +
      "Token(INT, 5),Token(FLOAT, 5.5),Token(class, undefined)," +
      "Token(--, undefined)") {
    throw new Error(tokens.toString());
  }
}

function lex(code, uri) {
  const lexer = new Lexer(new Source(code, uri));
  const tokens = [];
  while (lexer.peek().type !== 'EOF') {
    tokens.push(lexer.next());
  }
  tokens.push(lexer.peek());
  return tokens;
}

class Parser {
  constructor(code, uri) {
    this._tokens = lex(code, uri);
    this._pos = 0;

    // Module level variables
    this._aliases = Object.create(null);
  }
  peek(df) {
    if (df === undefined) {
      df = 0;
    }
    return this._tokens[Math.min(this._pos + df, this._tokens.length - 1)];
  }
  next() {
    const token = this.peek();
    this._pos++;
    return token;
  }
  at(type, df) {
    return this.peek(df).type === type;
  }
  consume(type) {
    if (this.at(type)) {
      return this.next();
    }
  }
  expect(type) {
    if (!this.at(type)) {
      throw new Error("Expected " + type + " but got " + this.peek());
    }
    return this.next();
  }
  parseModule() {
    const token = this.peek();
    const stmts = [];
    while (!this.at('EOF')) {
      if (this.at('TYPENAME') && this.at('NAME', 1) && this.at(';', 2)) {
        stmts.push(this.parseGlobalDecl());
      } else if (this.at('class') || this.at('interface') ||
                 (this.at('native') && (
                  this.at('class', 1) || this.at('interface', 1)))) {
        stmts.push(this.parseClassDef());
      } else {
        stmts.push(this.parseGlobalFuncDef());
      }
    }
    return new Module(token, stmts);
  }
  parseGlobalDecl() {
    const token = this.peek();
    const cls = this.expect('TYPENAME').val;
    const name = this.expect('NAME').val;
    this.expect(';');
    return new GlobalDecl(token, cls, name);
  }
  parseArgs() {
    const OPEN = '(';
    const CLOSE = ')';
    this.expect(OPEN);
    const args = [];
    while (!this.consume(CLOSE)) {
      const argtype = this.expect('TYPENAME').val;
      const argname = this.expect('NAME').val;
      args.push([argtype, argname]);
      if (!this.at(CLOSE)) {
        this.expect(',');
      }
    }
    return args;
  }
  parseGlobalFuncDef() {
    const token = this.peek();
    const isNative = !!this.consume('native');
    return this.parseFuncDef(token, isNative);
  }
  parseClassDef() {
    const token = this.peek();
    const isNative = !!this.consume('native');
    const isInterface = !!this.consume('interface');
    if (!isInterface) {
      this.expect('class');
    }
    const name = this.expect('TYPENAME').val;
    let base = null;
    if (this.consume('extends')) {
      base = this.expect('TYPENAME').val;
    }
    if (!isNative && base === null) {
      base = 'Object';
    }
    const interfs = [];
    if (this.consume('implements')) {
      interfs.push(this.expect('TYPENAME').val);
      while (this.consume(',')) {
        interfs.push(this.expect('TYPENAME').val);
      }
    }
    this.expect('{');
    const attrs = [];
    while (this.at('TYPENAME') && this.at('NAME', 1) && this.at(';', 2)) {
      const attrtype = this.expect('TYPENAME').val;
      const attrname = this.expect('NAME').val;
      this.expect(';');
      attrs.push([attrtype, attrname]);
    }
    const methods = [];
    while (!this.consume('}')) {
      methods.push(this.parseFuncDef(this.peek(), isNative));
    }
    return new ClassDef(token, isNative, isInterface,
                        name, base, interfs, attrs, methods);
  }
  parseFuncDef(token, isNative) {
    const ret = this.expect('TYPENAME').val;
    const name = this.expect('NAME').val;
    const args = this.parseArgs();
    let body = null;
    if (isNative) {
      this.expect(';');
    } else {
      body = this.parseBlock();
    }
    return new FuncDef(token, ret, name, args, body);
  }
  parseBlock() {
    const token = this.expect('{');
    const stmts = [];
    while (!this.consume('}')) {
      stmts.push(this.parseStatement());
    }
    return new Block(token, stmts);
  }
  parseStatement() {
    const token = this.peek();
    const OPEN = '{';
    const CLOSE = '}';
    if (this.at(OPEN)) {
      return this.parseBlock();
    } if (this.consume('return')) {
      const expr = this.parseExpression();
      this.expect(';');
      return new Return(token, expr);
    } else if (this.at('TYPENAME') && this.at('NAME', 1)) {
      const cls = this.expect('TYPENAME').val;
      const name = this.expect('NAME').val;
      let expr = null;
      if (this.consume('=')) {
        expr = this.parseExpression();
      }
      this.expect(';');
      return new Decl(token, cls, name, expr);
    } else {
      const expr = this.parseExpression();
      this.expect(';');
      return new ExpressionStatement(token, expr);
    }
  }
  parseExpression() {
    return this.parsePostfix();
  }
  parseExpressionList(open, close) {
    this.expect(open);
    const exprs = [];
    while (!this.consume(close)) {
      exprs.push(this.parseExpression());
      if (!this.at(close)) {
        this.expect(',');
      }
    }
    return exprs;
  }
  parsePostfix() {
    const OPEN = '(';
    const CLOSE = ')';
    let expr = this.parsePrimary();
    while (true) {
      const token = this.peek();
      if (this.consume('.')) {
        const name = this.expect('NAME').val;
        if (this.at(OPEN)) {
          const args = this.parseExpressionList(OPEN, CLOSE);
          expr = new MethodCall(token, expr, name, args);
        } else if (this.consume('=')) {
          const result = this.parseExpression();
          expr = new SetAttr(token, expr, name, result);
        } else {
          expr = new GetAttr(token, expr, name);
        }
        continue;
      }
      break;
    }
    return expr;
  }
  parsePrimary() {
    const OPEN = '(';
    const CLOSE = ')';
    const token = this.peek();
    if (this.at(OPEN)) {
      const expr = this.parseExpression();
      this.expect(CLOSE);
      return expr;
    }
    if (this.consume('TYPENAME')) {
      const typename = token.val;
      const args = this.parseExpressionList('(', ')');
      return new New(token, typename, args);
    }
    if (this.consume('NAME')) {
      const name = token.val;
      if (this.at(OPEN)) {
        const args = this.parseExpressionList(OPEN, CLOSE);
        return new FuncCall(token, name, args);
      } else if (this.consume('=')) {
        const expr = this.parseExpression();
        return new Assign(token, name, expr);
      } else {
        return new Name(token, name);
      }
    }
    if (this.consume("STR")) {
      const val = token.val;
      return new Str(token, val);
    }
    if (this.consume("INT")) {
      const val = token.val;
      return new Int(token, val);
    }
    if (this.consume("FLOAT")) {
      const val = token.val;
      return new Float(token, val);
    }
    throw new Error("Expected expression but found " + this.peek());
  }
}

function parse(code, uri) {
  return new Parser(code, uri).parseModule();
}

function indent(code) {
  return code.replace(/\n/g, '\n  ');
}

class GrokData {
  constructor() {
    // attributes filled during 'grok'
    this._funcsigs = Object.create(null);
    this._ancestry = Object.create(null);

    // Helpers during processInheritanceData
    this._processStarted = Object.create(null);
    this._processed = Object.create(null);

    // attributes filled/used during 'ann'
    this._currettypestack = [];
    this._varstack = new VarStack();
  }
  declareClass(name, base, interfs) {
    if (this._ancestry[name]) {
      throw new Error("Class " + name + " redeclared");
    }
    this._ancestry[name] = Object.create(null);
    this._ancestry[name][base] = true;
    for (const interf of interfs) {
      this._ancestry[name][interf] = true;
    }
  }
  processInheritanceData() {
    // Must be called after grok finishes but before ann starts.
    for (const className in this._ancestry) {
      this._process(className);
    }
  }
  _process(className) {
    if (className === null || this._processed[className]) {
      return;
    }
    if (this._processStarted[className]) {
      throw new Error("Infinite recursion in inheritance with " + className);
    }
    this._processStarted[className] = true;
    for (const baseName in this._ancestry[className]) {
      this._process(baseName);
    }
    for (const baseName of Object.keys(this._ancestry[className])) {
      this._ancestry[className][baseName] = true;
    }

  }
  _mergeMethodSignaturesWithAncestors(className) {
    // NOTE: This is probably very bad for very large number of classes and
    // functions (probably say 5000+ classes and functions)
    // Not an issue right now.
    const directMethods = Object.create(null);
    for (const funcName in this._funcsigs) {
      const [baseName, methodName] = funcName.split(".");
      if (baseName === className) {
        directMethods[methodName] = true;
      }
    }
    for (const funcName of Object.keys(this._funcsigs)) {
      const [baseName, methodName] = funcName.split(".");
      if (this.isSubclass(className, baseName)) {
        const key = className + '.' + methodName;
        if (!this._funcsigs[key]) {
          // We don't have a direct method, and we simply inherit from
          // our base.
          const [ret, args] = this._funcsigs[funcName];
          this._funcsigs[key] = [ret, Array.from(args)];
        } else if (!directMethods[methodName]) {
          // In this case, 'methodName' is not a direct method.
          // This means that the current values filled in at _funcsigs
          // are from another base. Assume that they are correct (
          // we will check for consistencies when we are processing the
          // classes for which they are direct methods).
          const aret = this._funcsigs[key][0];
          const aargs = this._funcsigs[key][1];
          const bret = this._funcsigs[funcName][0];
          const bargs = this._funcsigs[funcName][1];
          this._funcsigs[key][0] = this.isSubclass(aret, bret) ? aret : bret;
          const len = aargs.length;
          for (let i = 0; i < len; i++) {
            this._funcsigs[key][1][i] =
                this.isSubclass(aargs[i], bargs[i]) ? bargs[i] : aargs[i];
          }
        } else {
          // We have a direct method with same name as a base class.
          // We don't need to assign anything new to _funcsigs, but
          // we want to validate that this is legitimate.
          // The subclass must have a 'at least as specific' return type,
          // and must accept 'at least as broad' argument types
          // Also, argument length must be the same.
          const [baseRet, baseArgs] = this._funcsigs[funcName];
          const [ret, args] = this._funcsigs[key];
          if (args.length !== baseArgs.length) {
            throw new Error(
                key + " accepts " + args.length + " args but " +
                funcName + " accepts " + baseArgs.length);
          }
          if (!self.isSubclass(ret, baseRet)) {
            throw new Error(
                key + " returns " + ret + " args but " +
                funcName + " returns " + baseRet);
          }
          for (let i = 0; i < args.length; i++) {
            if (!self.isSubclass(baseArgs[i], args[i])) {
              throw new Error(
                  key + " accepts " + args[i] + " for arg " + i + " but " +
                  funcName + " accepts " + baseArgs[i] + " for arg " + i);
            }
          }
        }
      }
    }
    this._processed[className] = true;
  }
  isSubclass(subclass, baseclass) {
    return subclass === baseclass || !!this._ancestry[subclass][baseclass];
  }
  pushCurRettype(type) {
    this._currettypestack.push(type);
  }
  popCurRettype() {
    this._currettypestack.pop();
  }
  getCurRettype() {
    return this._currettypestack[this._currettypestack.length-1];
  }
  setVarType(name, type) {
    if (this._varstack.alreadySetLocally(name)) {
      throw new Error("Redeclaration of variable " + name);
    }
    this._varstack.set(name, type);
  }
  getVarType(name) {
    if (!this._varstack.get(name)) {
      throw new Error("Variable " + name + " has not been declared");
    }
    return this._varstack.get(name);
  }
  pushVarstack() {
    this._varstack.push();
  }
  popVarstack() {
    this._varstack.pop();
  }
  setFuncsig(name, rettype, argtypes) {
    if (this._funcsigs[name]) {
      throw new Error("Redeclaration of function " + name);
    }
    this._funcsigs[name] = [rettype, argtypes];
  }
  getFuncsig(name) {
    if (!this._funcsigs[name]) {
      throw new Error("Function " + name + " not declared");
    }
    return this._funcsigs[name];
  }
  getRettype(name) {
    return this.getFuncsig(name)[0];
  }
  getArgtypes(name) {
    return this.getFuncsig(name)[1];
  }
  castable(src, dest) {
    // TODO: Check inheritance tree to see if src can be cast to dest.
    return src === dest ||
           dest === 'Object' ||
           src === 'Object' ||
           isWrapperTypeFor(src, dest) ||
           isWrapperTypeFor(dest, src);
  }
  cast(expr, src, dest) {
    if (src === dest) {
      return expr;
    } else if (isPrimitive(src)) {
      if (isWrapperTypeFor(dest, src) || dest === 'Object') {
        return 'new xx$' + getWrapperType(src) + '(' + expr + ')';
      } else {
        throw new Error("Cannot cast from " + src + " to " + dest);
      }
    } else if (isPrimitive(dest)) {
      if (isWrapperTypeFor(src, dest)) {
        return expr + '.val';
      } else if (src === 'Object') {
        return 'yy$downcast(' + expr + ', xx$' +
               getWrapperType(dest) +  ').val';
      }
    } if (dest === 'Object') {
      return expr;
    } else {
      // TODO: Omit cast if src is a subclass of dest
      return 'yy$downcast(' + expr + ', xx$' + dest + ')';
    }
  }
}

class Ast {
  // Ast has three important API methods.
  //   - grok(data)
  //       dump information about class hierarchy, attribute types,
  //       method types and method arg types in the 'data' object,
  //       (Only passes Module, GlobalDecl, FuncDef and ClassDef).
  //   - ann(data)
  //       use the data filled in during 'grok' to annotate expressions
  //       with types. In the future also validate.
  //   - gen()
  //       generate javascript code. Requires that 'ann' was already called
  //       to annotate the tree.
  constructor(token) {
    this.token = token;
  }
}

class VarStack {
  constructor() {
    this.stack = [Object.create(null)];
  }
  push() {
    this.stack.push(Object.create(this.stack[this.stack.length-1]));
  }
  pop() {
    this.stack.pop();
  }
  peek() {
    return this.stack[this.stack.length-1];
  }
  set(name, type) {
    this.peek()[name] = type;
  }
  get(name) {
    return this.peek()[name];
  }
  alreadySetLocally(name) {
    return Object.hasOwnProperty.apply(this.peek(), [name]);
  }
}

class Module extends Ast {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;  // [GlobalDecl|FuncDef|ClassDef]
  }
  grok(data) {
    for (const stmt of this.stmts) {
      stmt.grok(data);
    }
  }
  ann(data) {
    for (const stmt of this.stmts) {
      stmt.ann(data);
    }
  }
  gen() {
    return this.stmts.map((stmt) => stmt.gen()).join("");
  }
}

class GlobalDecl extends Ast {
  constructor(token, cls, name) {
    super(token);
    this.cls = cls;
    this.name = name;
  }
  grok(data) {}
  ann(data) {
    data.setVarType(this.name, this.cls);
  }
  gen() {
    return '\nlet xx$' + this.name + ' = null;';
  }
}

class FuncDef extends Ast {
  constructor(token, ret, name, args, body) {
    super(token);
    this.ret = ret;
    this.name = name;
    this.args = args;
    this.body = body;
  }
  getArgtypes() { return this.args.map(arg => arg[0]); }
  getArgnames() { return this.args.map(arg => arg[1]); }
  grok(data) {
    data.setFuncsig(this.name, this.ret, this.getArgtypes());
  }
  ann(data) {
    data.pushVarstack();
    data.pushCurRettype(this.ret);
    for (const [type, arg] of this.args) {
      data.setVarType(arg, type);
    }
    if (this.body) {
      this.body.ann(data);
    }
    if (this.ret !== 'void' && this.body !== null && !this.body.returns()) {
      throw new Error(
          "Function " + this.name + " should return " +
          this.ret + " but might not return");
    }
    data.popVarstack();
    data.popCurRettype();
  }
  gen() {
    if (this.body) {
      const args = this.args.map(arg => '/*' + arg[0] + '*/ ' + arg[1]);
      return ('\nfunction /*' + this.ret + '*/ xx$' + this.name +
              '(' + args.join(",") + ')' +
              this.body.gen());
    } else {
      return '\n/* (native function) ' + this.name +
             '(' + this.getArgtypes().join(", ") + ') */';
    }
  }
}

class ClassDef extends Ast {
  constructor(token, isNative, isInterface,
              name, base, interfs, attrs, methods) {
    super(token);
    this.isNative = isNative;  // bool
    this.isInterface = isInterface;  // bool
    this.name = name;  // string
    this.base = base;  // string
    this.interfs = interfs;  // [string]
    this.attrs = attrs;  // [(type:string, name:string)]
    this.methods = methods;  // [FuncDef]
  }
  grok(data) {
    for (const method of this.methods) {
      data.setFuncsig(this.name + '.' + method.name,
                      method.ret, method.getArgtypes());
    }
  }
  ann(data) {
    for (const method of this.methods) {
      method.ann(data);
    }
  }
  gen() {
    if (this.isNative) {
      return '\n/* native class ' + this.name + ' */';
    }
    const methods = this.methods.map(
        method => method.gen().replace(/\bfunction /, ''));
    return ('\nclass xx$' + this.name + ' extends xx$' + this.base +
            ' {' + indent(methods.join("")) + '\n}');
  }
}

class Statement extends Ast {
  returns() { return false; }
}

class Block extends Statement {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;
  }
  returns() {
    return this.stmts.length > 0 && this.stmts[this.stmts.length-1].returns();
  }
  ann(data) {
    data.pushVarstack();
    for (let stmt of this.stmts) {
      stmt.ann(data);
    }
    data.popVarstack();
  }
  gen() {
    return '\n{' +
           indent(this.stmts.map(stmt => stmt.gen()).join("")) +
           '\n}';
  }
}

class Decl extends Statement {
  constructor(token, cls, name, expr) {
    super(token);
    this.cls = cls;
    this.name = name;
    this.expr = expr;
  }
  ann(data) {
    if (this.expr !== null) {
      this.expr.ann(data);
      if (!data.castable(this.expr.exprType, this.cls)) {
        throw new Error(
            "Tried to initialize variable of type " + this.cls +
            " with a value of type " + this.expr.exprType);
      }
    }
    data.setVarType(this.name, this.cls);
    this.data = data;
  }
  gen() {
    if (this.expr === null) {
      return '\nlet xx$' + this.name + ' = null;';
    } else {
      return '\nlet xx$' + this.name + ' = ' + this.data.cast(
          this.expr.gen(), this.expr.exprType, this.cls) + ';';
    }
  }
}

class Return extends Statement {
  constructor(token, expr) {
    super(token);
    this.expr = expr;
  }
  returns() { return true; }
  ann(data) {
    this.expr.ann(data);
    if (!data.castable(this.expr.exprType, data.getCurRettype())) {
      throw new Error(
          "Function returns " + data.getCurRettype() + " but tried to " +
          "return " + this.expr.exprType);
    }
    this.data = data;
    this.curtype = data.getCurRettype();
  }
  gen() {
    return '\nreturn ' + this.data.cast(
        this.expr.gen(), this.expr.exprType, this.curtype) + ';';
  }
}

class ExpressionStatement extends Statement {
  constructor(token, expr) {
    super(token);
    this.expr = expr;
  }
  ann(data) {
    this.expr.ann(data);
  }
  gen() {
    return '\n' + this.expr.gen() + ';';
  }
}

class Expression extends Ast {
  constructor(token) {
    super(token);
    this.exprType = null;
  }
}

function checkArgtypes(data, expectedTypes, actualTypes, message) {
  if (message === undefined) {
    message = '';
  }
  if (expectedTypes.length !== actualTypes.length) {
    throw new Error("Expected " + expectedTypes.length + " args but got " +
                    actualTypes.length + message);
  }
  const len = expectedTypes.length;
  for (let i = 0; i < len; i++) {
    if (!data.castable(actualTypes[i], expectedTypes[i])) {
      throw new Error(
          "Expected arg " + i + " to be " + expectedTypes[i] + " but got " +
          actualTypes[i]);
    }
  }
}

function castArgs(data, args, expectedTypes) {
  const outArgs = [];
  for (let i = 0; i < expectedTypes.length; i++) {
    outArgs.push(
      data.cast(args[i].gen(),
                args[i].exprType, expectedTypes[i]));
  }
  return outArgs;
}

class FuncCall extends Expression {
  constructor(token, name, args) {
    super(token);
    this.name = name;
    this.args = args;
  }
  ann(data) {
    for (const arg of this.args) {
      arg.ann(data);
    }
    this.exprType = data.getRettype(this.name);
    const actualArgtypes = this.args.map(arg => arg.exprType);
    checkArgtypes(data, data.getArgtypes(this.name), actualArgtypes);
    this.data = data;
  }
  gen() {
    const args = castArgs(this.data, this.args,
                          this.data.getArgtypes(this.name));
    return 'xx$' + this.name + '(' + args.join(", ") + ')';
  }
}

// NOTE: mixing int and float arithmetic is illegal by design.
const PRIMITIVE_METHOD_TABLE = {
  'int.__add__(int)': ['int', (owner, name, args) => {
    return '(' + owner.gen() + ' + ' + args[0].gen() + ')';
  }],
  'int.__sub__(int)': ['int', (owner, name, args) => {
    return '(' + owner.gen() + ' - ' + args[0].gen() + ')';
  }],
  'int.__mul__(int)': ['int', (owner, name, args) => {
    return '(' + owner.gen() + ' * ' + args[0].gen() + ')';
  }],
  'int.__div__(int)': ['int', (owner, name, args) => {
    return '((' + owner.gen() + ' / ' + args[0].gen() + ')|0)';
  }],
  'int.__mod__(int)': ['int', (owner, name, args) => {
    return '(' + owner.gen() + ' % ' + args[0].gen() + ')';
  }],
  'float.__add__(float)': ['float', (owner, name, args) => {
    return '(' + owner.gen() + ' + ' + args[0].gen() + ')';
  }],
  'float.__sub__(float)': ['float', (owner, name, args) => {
    return '(' + owner.gen() + ' - ' + args[0].gen() + ')';
  }],
  'float.__mul__(float)': ['float', (owner, name, args) => {
    return '(' + owner.gen() + ' * ' + args[0].gen() + ')';
  }],
  'float.__div__(float)': ['float', (owner, name, args) => {
    return '(' + owner.gen() + ' / ' + args[0].gen() + ')';
  }],
  'string.__add__(string)': ['string', (owner, name, args) => {
    return '(' + owner.gen() + ' + ' + args[0].gen() + ')';
  }],
};

function lookupPrimitiveMethodTable(owner, name, args) {
  const ownerType = owner.exprType;
  const argtypes = args.map(arg => arg.exprType);
  const key = ownerType + '.' + name + '(' + argtypes.join(",") + ')';
  if (!PRIMITIVE_METHOD_TABLE[key]) {
    throw new Error("No such primitive method with signature " + key);
  }
  return PRIMITIVE_METHOD_TABLE[key];
}

function getPrimitiveMethodType(owner, name, args) {
  const ownerType = owner.exprType;
  const argtypes = args.map(arg => arg.exprType);
  const key = ownerType + '.' + name + '(' + argtypes.join(",") + ')';
  return lookupPrimitiveMethodTable(owner, name, args)[0];
}

function genPrimitiveMethod(owner, name, args) {
  const ownerType = owner.exprType;
  const argtypes = args.map(arg => arg.exprType);
  const key = ownerType + '.' + name + '(' + argtypes.join(",") + ')';
  if (!PRIMITIVE_METHOD_TABLE[key]) {
    throw new Error("No such primitive method with signature " + key);
  }
  return lookupPrimitiveMethodTable(owner, name, args)[1](owner, name, args);
}

class MethodCall extends Expression {
  constructor(token, owner, name, args) {
    super(token);
    this.owner = owner;
    this.name = name;
    this.args = args;
  }
  ann(data) {
    this.owner.ann(data);
    for (const arg of this.args) {
      arg.ann(data);
    }
    const name = this.owner.exprType + '.' + this.name;
    if (isPrimitive(this.owner.exprType)) {
      // If the method is on a primitive type, we have special hardcoded
      // rules --
      this.exprType = getPrimitiveMethodType(
          this.owner, this.name, this.args);
      if (!this.exprType) {
        throw new Error("No primitive method: " + name);
      }
    } else {
      this.exprType = data.getRettype(name);
      const actualArgtypes = this.args.map(arg => arg.exprType);
      checkArgtypes(data, data.getArgtypes(name), actualArgtypes);
    }
    this.data = data;
  }
  gen() {
    if (isPrimitive(this.owner.exprType)) {
      // Primitive types have special hardcoded rules --
      return genPrimitiveMethod(this.owner, this.name, this.args);
    }
    const name = this.owner.exprType + '.' + this.name;
    const args = castArgs(this.data, this.args,
                          this.data.getArgtypes(name));
    return this.owner.gen() + '.xx$' + this.name +
           '(' + args.join(", ") + ')';
  }
}

class New extends Expression {
  constructor(token, cls, args) {
    super(token);
    this.cls = cls;
    this.args = args;
  }
  ann(data) {
    for (const arg of this.args) {
      arg.ann(data);
    }
    this.exprType = this.cls;
  }
  gen() {
    return 'new xx$' + this.cls + '(' +
           this.args.map(arg => arg.gen()).join(", ") + ')';
  }
}

class Int extends Expression {
  constructor(token, val) {
    super(token);
    this.val = val;
  }
  ann(data) {
    this.exprType = 'int';
  }
  gen() {
    return this.val.toString();
  }
}

class Float extends Expression {
  constructor(token, val) {
    super(token);
    this.val = val;
  }
  ann(data) {
    this.exprType = 'float';
  }
  gen() {
    return this.val.toString();
  }
}

class Str extends Expression {
  constructor(token, val) {
    super(token);
    this.val = val;
  }
  ann(data) {
    this.exprType = 'string';
  }
  gen() {
    return '"' + sanitizeString(this.val) + '"';
  }
}

class Name extends Expression {
  constructor(token, name) {
    super(token);
    this.name = name;
  }
  ann(data) {
    this.exprType = data.getVarType(this.name);
  }
  gen() {
    return 'xx$' + this.name;
  }
}

class Assign extends Expression {
  constructor(token, name, expr) {
    super(token);
    this.name = name;
    this.expr = expr;
  }
  ann(data) {
    this.expr.ann(data);
    this.exprType = data.getVarType(this.name);
    if (!data.castable(this.expr.exprType, this.exprType)) {
      console.log(this.expr);
      throw new Error(
          "Tried to assign " + this.expr.exprType + " to a " +
          this.exprType + " variable");
    }
    this.data = data;
  }
  gen() {
    return 'xx$' + this.name + ' = ' +
           this.data.cast(this.expr.gen(), this.expr.exprType, this.exprType);
  }
}

const NATIVE_PRELUDE = `"use strict";

// BEGIN NATIVE PRELUDE
function xx$print(x) {
  console.log(x);
}

function yy$downcast(x, target) {
  if (!(x instanceof target)) {
    throw new Error(
        x.constructor.name.slice(3) + " cannot be cast to " +
        target.name.slice(3));
  }
  return x;
}

class xx$Object {
  xx$__repr__() {
    return '<' + this.constructor.name.slice(3) + ' instance>';
  }
  xx$__str__() {
    return this.xx$__repr__();
  }
  toString() {
    return this.xx$__str__();
  }
  inspect() {
    return this.xx$__repr__();
  }
}

class PrimitiveWrapperType extends xx$Object {
  constructor(val) {
    super();
    this.val = val;
  }
  xx$__str__() {
    return this.val.toString();
  }
  xx$__repr__() {
    return this.val.toString();
  }
  xx$__eq__(other) {
    return this.constructor === other.constructor &&
           this.val === other.val;
  }
}

class xx$String extends PrimitiveWrapperType {
  xx$__add__(str) {
    return new xx$String(this.val + str.val);
  }
}

class xx$Int extends PrimitiveWrapperType {
}

class xx$Float extends PrimitiveWrapperType {
}

// END PRELUDE
`;

function transpile(code, uri) {
  const module = parse(code, uri);
  const data = new GrokData();
  module.grok(data);
  data.processInheritanceData();
  module.ann(data);
  return NATIVE_PRELUDE + module.gen() + '\n\nxx$main();';
}
const code = `

native class Object {
  string __str__();
  string __repr__();
  float __hash__();
  bool __eq__(Object other);
  bool __ne__(Object other);
  bool __lt__(Object other);
  bool __le__(Object other);
  bool __gt__(Object other);
  bool __ge__(Object other);
  int __len__();
}
native class Float extends Object {
  Float __add__(Float other);
  Float __sub__(Float other);
  Float __div__(Float other);
  bool __eq__(Object other);
  string __repr__();
}
native class String extends Object {
  String __add__(String other);
  String __str__();
  String __repr__();
  bool __eq__(Object other);
  float __len__();
}
native void print(Object item);

float x;
string y;

void f() {
  print("Hello from function f");
}

void g(Object x) {
  print(x);
}

class Sample {
  int len() { return 5; }
}

Object z;

string repr(Object x) {
  return x.__repr__();
}

int len(Object xx) {
  return xx.__len__();
}

void main() {
  f();
  print("Hello ".__add__("world!"));
  y = 'hi';
  print(y);
  print(y.__add__(' there'));
  print(1 .__add__(2));
  print(1. .__add__(2.2));
  print(5 .__div__(2));
  int x = 5;
  print(x);
  Sample s = Sample();
  print(s);
  print(s.len());
}

`;

// console.log(lex(code));
console.log(transpile(code));
})();
