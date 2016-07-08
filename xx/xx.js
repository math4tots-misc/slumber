/* jshint esversion: 6 */

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
    // potential future primtiive types
    string: true,
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

function isPrimitive(str) {
  return str === 'void' || str === 'bool' || str === 'int' || str === 'float';
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
    this.expect('class');
    const name = this.expect('TYPENAME').val;
    let base = null;
    if (this.consume('extends')) {
      base = this.expect('TYPENAME').val;
    }
    if (!isNative && base === null) {
      base = 'Object';
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
    return new ClassDef(token, isNative, name, base, attrs, methods);
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
    this._varstack = new VarStack();
    this._funcsigs = Object.create(null);
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
    return src === dest;
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
    for (const [type, arg] of this.args) {
      data.setVarType(arg, type);
    }
    if (this.body) {
      this.body.ann(data);
    }
    data.popVarstack();
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
  constructor(token, isNative, name, base, attrs, methods) {
    super(token);
    this.isNative = isNative;  // bool
    this.name = name;  // string
    this.base = base;  // string
    this.attrs = attrs;  // [(type:string, name:string)]
    this.methods = methods;  // [FuncDef]
  }
  grok(data) {
    for (const method of this.methods) {
      data.setFuncsig(
          this.name + '.' + method.name, method.ret, method.getArgtypes());
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
    return ('\nclass xx$' + this.name + ' extends xx$' + this.base +
            ' {' + indent(
                this.methods.map(method => method.gen()).join("")
            ) + '\n}');
  }
}

class Statement extends Ast {}

class Block extends Statement {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;
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
    const argtypes = data.getArgtypes(this.name);

    if (this.args.length !== argtypes.length) {
      throw new Error(
          this.name + " expects " + argtypes.length + " arguments but got " +
          this.args.length);
    }
  }
  gen() {
    return 'xx$' + this.name + '(' +
           this.args.map(arg => arg.gen()).join(", ") + ')';
  }
}

const PRIMITIVE_METHOD_TABLE = {
  'int.__add__(int)': ['int', (owner, name, args) => {
    return '(' + owner.gen() + ' + ' + args[0].gen() + ')';
  }],
  'float.__add__(float)': ['float', (owner, name, args) => {
    return '(' + owner.gen() + ' + ' + args[0].gen() + ')';
  }],
  'int.__add__(float)': ['float', (owner, name, args) => {
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
      const argtypes = data.getArgtypes(name);

      if (this.args.length !== argtypes.length) {
        throw new Error(
            name + " expects " + argtypes.length + " arguments but got " +
            this.args.length);
      }
    }
  }
  gen() {
    if (isPrimitive(this.owner.exprType)) {
      // Primitive types have special hardcoded rules --
      return genPrimitiveMethod(this.owner, this.name, this.args);
    }
    const args = this.args.map(arg => arg.gen());
    return this.owner.gen() + '.xx$' + this.name +
           '(' + args.join(", ") + ')';
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
    this.exprType = 'String';
  }
  gen() {
    return 'new xx$String("' + sanitizeString(this.val) + '")';
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
  }
  gen() {
    return 'xx$' + this.name + ' = ' + this.expr.gen();
  }
}

const NATIVE_PRELUDE = `
"use strict";

// BEGIN NATIVE PRELUDE
function xx$print(x) {
  console.log(x);
}

class xx$Object {}

class PrimitiveWrapperType extends xx$Object {
  constructor(val) {
    super();
    this.val = val;
  }
  toString() {
    return this.val.toString();
  }
  inspect() {
    return this.toString();
  }
}

class xx$String extends PrimitiveWrapperType {
  xx$__add__(str) {
    return new xx$String(this.val + str.val);
  }
}
// END PRELUDE
`;

function transpile(code, uri) {
  const module = parse(code, uri);
  const data = new GrokData();
  module.grok(data);
  module.ann(data);
  return NATIVE_PRELUDE + module.gen() + '\n\nxx$main();';
}
const code = `

native class Object {}
native class String extends Object {
  String __add__(String other);
}
native void print(Object item);

int x;
String y;

void f() {
  print("Hello from function f");
}

void g(Object x) {
  print(x);
}

class Sample {
  // int len() { return 5; }
}

void main() {
  f();
  print("Hello ".__add__("world!"));
  y = 'hi';
  print(y);
  print(y.__add__(' there'));
  print(1 .__add__(2));
  print(1 .__add__(2.2));
}

`;

// console.log(lex(code));

console.log(transpile(code));
