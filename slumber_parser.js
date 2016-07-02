/* jshint esversion: 6 */

// This file contains all the code necessary to parse a 'slumber' program
// into an abstract syntax tree.

// exports:
//   function test()
//     Run tests for this module.
//   class Source
//     Create a source for the parse function.
//     e.g. new Source('<test>', '5 + 6')
//   function parse(src: Source): Ast
//     Parse a program.
//     The resulting Ast can be traversed by a visitor --
//     when you 'accep [sic]' a visitor, the method correspnding to
//     the Ast node will be called on the visitor: for instance,
//     'new Name(..).accep(visitor)' will result in 'visitor.visitName(node)'
//      being called where 'node' is the 'Name' object that you called 'accep'
//      on.

// Major sections in this file:
////// Source, Token and SlumberError
////// lex
////// Ast
////// Parser

////// Source, Token and SlumberError
class Source {
  constructor(uri, dat) {
    this.uri = uri;  // string (where dat came from)
    this.dat = dat;  // string (contents of program)
  }
}

class Token {
  constructor(src, pos, typ, val) {
    this.src = src;  // Source
    this.pos = pos;  // int (location in src.dat)
    this.typ = typ;  // string (token type)
    this.val = val;  // any (token value, depends on typ [sic])
  }

  getLineNumber() {
    let lineNumber = 1;
    for (let i = 0; i < this.pos; i++) {
      if (this.src.dat[i] === '\n') {
        lineNumber++;
      }
    }
    return lineNumber;
  }

  getColumnNumber() {
    let columnNumber = 1;
    for (let i = this.pos; i > 0 && this.src.dat[i-1] !== '\n'; i--) {
      columnNumber++;
    }
    return columnNumber;
  }

  getLine() {
    let str = this.src.dat;
    let lineStart = this.pos;
    while (lineStart > 0 && str[lineStart-1] !== '\n') {
      lineStart--;
    }
    let lineEnd = this.pos;
    while (lineEnd < str.length && str[lineEnd] !== '\n') {
      lineEnd++;
    }
    return str.slice(lineStart, lineEnd);
  }

  getLocationMessage() {
    return (
        '\nFile "' + this.src.uri + '", line ' + this.getLineNumber() +
        '\n' + this.getLine() +
        '\n' + ' '.repeat(this.getColumnNumber()-1) + '*');
  }

  toString() {
    return (
        'Token(source, ' + this.pos + ', ' + this.typ + ', ' +
        this.val + ')');
  }

  inspect() {
    return this.toString();
  }
}

class SlumberError extends Error {
  constructor(message, token) {
    super(message);
    this.slumberTrace = [];
    if (token) {
      this.addTokenToSlumberTrace(token);
    }
  }

  addTokenToSlumberTrace(token) {
    this.slumberTrace.push(token);
  }

  getSlumberTrace() {
    let trace = '';
    for (let token of this.slumberTrace) {
      trace += token.getLocationMessage();
    }
    return trace;
  }

  toString() {
    return (
        this.toStringWithoutJavascriptTrace() +
        '\n\n--- javascript trace --- \n' + this.stack);
  }

  toStringWithoutJavascriptTrace() {
    return (
        super.toString() +
        '\n--- slumber trace ---' + this.getSlumberTrace());
  }
}

////// lex

let KEYWORDS = [
  // keywords from Python
  'False', 'class', 'finally', 'is', 'return',
  'None', 'continue', 'for', 'lambda', 'try',
  'True', 'def', 'from', 'nonlocal', 'while',
  'and', 'del', 'global', 'not', 'with',
  'as', 'elif', 'if', 'or', 'yield',
  // 'assert',  // 'assert' is not going to be keyword.
  'else', 'import', 'pass',
  'break', 'except', 'in', 'raise',
  // my keywords
  'self', 'super',
  'async', 'await', 'sync',
];

let SYMBOLS = [
  // operators
  '+', '-', '*', '**', '/', '//', '%', '@',
  '<<', '>>', '&', '|', '^', '~',
  '<', '>', '<=', '>=', '==', '!=',
  // delimiters
  '(', ')', '[', ']', '{', '}',
  ',', ':', '.', ';', '@', '=', '->',
  '+=', '-=', '*=', '/=', '//=', '%=', '@=',
  '&=', '|=', '^=', '>>=', '<<=', '**=',
  // -- ellipsis -- special token.
  '...',
  // my symbols
  '\\',
];

let ESCAPE_TABLE = {
  '\\': '\\',
  "'": "'",
  '"': '"',
  'n': '\n',
  't': '\t',
  'r': '\r',
  'f': '\f',
};

let REVERSE_ESCAPE_TABLE = {};
for (let key of Object.keys(ESCAPE_TABLE)) {
  REVERSE_ESCAPE_TABLE[ESCAPE_TABLE[key]] = key;
}

function escapeString(s) {
  let e = '"';
  for (let c of s) {
    if (REVERSE_ESCAPE_TABLE[c]) {
      e += REVERSE_ESCAPE_TABLE[c];
    } else {
      e += c;
    }
  }
  e += '"';
  return e;
}

function isSpace(c) {
  return ' \t\n\r\f'.indexOf(c) !== -1;
}

function isDigit(c) {
  return '0123456789'.indexOf(c) !== -1;
}

function isAlpha(c) {
  if (c === undefined) {
    return false;
  }
  return 'abcdefghijklmnopqrstuvwxyz'.indexOf(c.toLowerCase()) !== -1;
}

function isAlnum(c) {
  return isDigit(c) || isAlpha(c);
}

function isWordChar(c) {
  return c === '_' || isAlnum(c);
}

function lex(source) {
  if (!(source instanceof Source)) {
    throw new Error('lex requires a Source instance as argument');
  }

  let tokens = [];
  let s = source.dat;
  let i = 0;
  let indentStack = [0];
  let parenDepth = 0;

  function skipEmptyLine() {
    if (i >= s.length) {
      return false;
    }

    let j = i;
    while (j < s.length && s[j] !== '\n') {
      if (s[j] === '#') {  // skip comments
        while (j < s.length && s[j] !== '\n') {
          j++;
        }
      } else if (isSpace(s[j])) {  // skip spaces
        j++;
      } else {  // we've hit a non-whitespace, non-comment character
        return false;
      }
    }
    // skipping an empty line includes skipping the terminating newline
    if (s[j] === '\n') {
      j++;
    }
    i = j;
    return true;
  }

  function skipEmptyLines() {
    while (skipEmptyLine());
  }

  function skipSpaces() {
    while (true) {
      if (s[i] === '\\' && s[i+1] === '\n') {
        // escaped newline
        i += 2;
      } else if (s[i] === '#') {
        // comments
        while (i < s.length && s[i] !== '\n') {
          i++;
        }
      } else if (isSpace(s[i]) && (s[i] !== '\n' || parenDepth > 0)) {
        // spaces, and newlines only if we are nested inside parenthesis
        i++;
      } else {
        break;
      }
    }
  }

  function processIndentation() {
    let j = i;
    while (s[j] === ' ') {
      j++;
    }
    if (s[j] === '\t') {
      throw new SlumberError(
          'Indentation with tabs are not allowed',
          new Token(source, j, 'ERR'));
    }
    let depth = j - i;
    let lastIndent = indentStack[indentStack.length - 1];
    if (lastIndent < depth) {
      indentStack.push(depth);
      tokens.push(new Token(source, j, 'INDENT'));
    } else if (lastIndent > depth) {
      while (indentStack[indentStack.length-1] > depth) {
        indentStack.pop();
        tokens.push(new Token(source, j, 'DEDENT'));
      }
      if (indentStack[indentStack.length-1] !== depth) {
        throw new SlumberError(
            'Invalid indentation depth',
            new Token(source, j, 'ERR'));
      }
    }
  }

  function startsWithOneOf(prefixes, i) {
    for (let prefix of prefixes) {
      if (s.startsWith(prefix, i)) {
        return true;
      }
    }
    return false;
  }

  // tokenizing logic
  while (true) {  // for each line
    skipEmptyLines();
    processIndentation();
    if (i >= s.length) {
      break;
    }
    while (true) {  // for each token on this line
      skipSpaces();

      // NEWLINE
      if (i >= s.length || s[i] === '\n') {
        tokens.push(new Token(source, i, 'NEWLINE'));
        break;
      }

      // STRING
      if (startsWithOneOf(['"', "'", 'r"""', "r'''"], i)) {
        let j = i;
        let raw = false;
        if (s[i] === 'r') {
          i++;
          raw = true;
        }
        let value = '';
        let quote;
        if (startsWithOneOf(['"""', "'''"], i)) {
          quote = s.substring(i, i+3);
        } else {
          quote = s[i];
        }
        i += quote.length;
        while (!s.startsWith(quote, i)) {
          if (i >= s.length) {
            throw new SlumberError(
                'Unterminated string literal',
                new Token(source, j, 'ERR'));
          } else if (!raw && s[i] === '\\') {
            i++;
            let escape = ESCAPE_TABLE[s[i]];
            if (!escape) {
              throw new SlumberError(
                  'Invalid string escape: ' + s[i],
                  new Token(source, i, 'ERR'));
            }
            value += escape;
            i++;
          } else {
            value += s[i];
            i++;
          }
        }
        i += quote.length;
        tokens.push(new Token(source, j, 'STRING', value));
        continue;
      }

      // NUMBER
      if (isDigit(s[i]) || s[i] === '.' && isDigit(s[i+1])) {
        let j = i;
        while (isDigit(s[i])) {
          i++;
          if (s[i] === '.') {
            i++;
            while (isDigit(s[i])) {
              i++;
            }
          }
        }
        let value = parseFloat(s.substring(j, i));
        tokens.push(new Token(source, j, 'NUMBER', value));
        continue;
      }

      // NAME/KEYWORDS
      if (isWordChar(s[i])) {
        let j = i;
        while (isWordChar(s[i])) {
          i++;
        }
        let word = s.substring(j, i);
        if (KEYWORDS.indexOf(word) !== -1) {
          tokens.push(new Token(source, j, word));
        } else {
          tokens.push(new Token(source, j, 'NAME', word));
        }
        continue;
      }

      // SYMBOLS
      let symbol = '';
      for (let sym of SYMBOLS) {
        if (s.startsWith(sym, i) && sym.length > symbol) {
          symbol = sym;
        }
      }
      if (symbol !== '') {
        if ('([{'.indexOf(symbol) !== -1) {
          parenDepth++;
        } else if ('}])'.indexOf(symbol) !== -1) {
          parenDepth--;
        }
        tokens.push(new Token(source, i, symbol));
        i += symbol.length;
        continue;
      }

      // ERR
      let j = i;
      while (i < s.length && !isSpace(s[i])) {
        i++;
      }
      throw new SlumberError(
          'Unrecognized token', new Token(source, j, 'ERR'));
    }
  }
  tokens.push(new Token(source, i, 'EOF'));
  return tokens;
}

////// Ast

class Ast {
  constructor(token) {
    this.token = token;
  }

  toString() {
    let s = '\n' + this.constructor.name;
    for (let key of Object.keys(this)) {
      let value = this[key];
      if (value === undefined) {
        value = 'undefined';
      }
      s += (
        '\n' + key + ' = ' + value.toString()
      ).replace(/[ ]*\n/g, '\n  ');
    }
    return s;
  }

  inspect() {
    return this.toString();
  }
}

class FileInput extends Ast {
  constructor(token, statements, imports, vars) {
    super(token);
    this.bod = new Block(token, statements);
    this.imports = imports;  // [string]
    this.vars = vars;  // [string]
  }

  accep(visitor) {
    return visitor.visitFileInput(this);
  }
}

class Block extends Ast {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;  // [Statement]
  }

  accep(visitor) {
    return visitor.visitBlock(this);
  }
}

class ArgumentList extends Ast {
  constructor(token, args, optargs, vararg, texprs) {
    super(token);
    this.args = args;  // [string]
    this.optargs = optargs;  // [string]
    this.vararg = vararg;  // string|undefined
    this.texprs = texprs;  // [Expression]
    if (args.length + optargs.length != texprs.length) {
      throw new SlumberError(
          'Invalid type expressions for Argumentlist', token);
    }
  }

  accep(visitor) {
    return visitor.visitArgumentList(this);
  }
}

class ExpressionList extends Ast {
  constructor(token, exprs, varexpr) {
    super(token);
    this.exprs = exprs;  // [Expression]
    this.varexpr = varexpr;  // Expression|undefined
  }

  accep(visitor) {
    return visitor.visitExpressionList(this);
  }
}

class Expression extends Ast {}

class SimpleAssignment extends Expression {
  constructor(token, nam, expr) {
    super(token);
    this.nam = nam;  // string
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitSimpleAssignment(this);
  }
}

class Name extends Expression {
  constructor(token, nam) {
    super(token);
    this.nam = nam;  // string
  }

  accep(visitor) {
    return visitor.visitName(this);
  }
}

class Self extends Expression {
  accep(visitor) {
    return visitor.visitSelf(this);
  }
}

class NumberLiteral extends Expression {
  constructor(token, val) {
    super(token);
    this.val = val;  // number
  }

  accep(visitor) {
    return visitor.visitNumberLiteral(this);
  }
}

class StringLiteral extends Expression {
  constructor(token, val) {
    super(token);
    this.val = val;  // string
  }

  accep(visitor) {
    return visitor.visitStringLiteral(this);
  }
}

class ListDisplay extends Expression {
  constructor(token, exprlist) {
    super(token);
    this.exprlist = exprlist;  // ExpressionList
  }

  accep(visitor) {
    return visitor.visitListDisplay(this);
  }
}

class GetAttribute extends Expression {
  constructor(token, owner, nam) {
    super(token);
    this.owner = owner;  // Expression
    this.nam = nam;  // string
  }

  accep(visitor) {
    return visitor.visitGetAttribute(this);
  }
}

class SetAttribute extends Expression {
  constructor(token, owner, nam, expr) {
    super(token);
    this.owner = owner;  // Expression
    this.nam = nam;  // string
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitSetAttribute(this);
  }
}

class MethodCall extends Expression {
  constructor(token, owner, nam, exprlist) {
    super(token);
    this.owner = owner;  // Expression
    this.nam = nam;  // string
    this.exprlist = exprlist;  // ExpressionList
  }

  accep(visitor) {
    return visitor.visitMethodCall(this);
  }
}

function operatorCall(token, owner, nam, args) {
  return new MethodCall(token, owner, nam, new ExpressionList(token, args));
}

class SuperMethodCall extends Expression {
  constructor(token, nam, exprlist) {
    super(token);
    this.nam = nam;  // string
    this.exprlist = exprlist;  // ExpressionList
  }

  accep(visitor) {
    return visitor.visitSuperMethodCall(this);
  }
}

class Not extends Expression {
  constructor(token, expr) {
    super(token);
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitNot(this);
  }
}

class And extends Expression {
  constructor(token, lhs, rhs) {
    super(token);
    this.lhs = lhs;  // Expression
    this.rhs = rhs;  // Expression
  }

  accep(visitor) {
    return visitor.visitAnd(this);
  }
}

class Or extends Expression {
  constructor(token, lhs, rhs) {
    super(token);
    this.lhs = lhs;  // Expression
    this.rhs = rhs;  // Expression
  }

  accep(visitor) {
    return visitor.visitOr(this);
  }
}

class Ternary extends Expression {
  constructor(token, cond, lhs, rhs) {
    super(token);
    this.cond = cond;  // Expression
    this.lhs = lhs;  // Expression
    this.rhs = rhs;  // Expression
  }

  accep(visitor) {
    return visitor.visitTernary(this);
  }
}

class Lambda extends Expression {
  constructor(token, arglist, expr, vars) {
    super(token);
    this.arglist = arglist;  // ArgumentList
    this.expr = expr;  // Expression
    this.vars = vars;  // [string]
  }

  accep(visitor) {
    return visitor.visitLambda(this);
  }
}

class Yield extends Expression {
  constructor(token, expr) {
    super(token);
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitYield(this);
  }
}

class YieldStar extends Expression {
  constructor(token, expr) {
    super(token);
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitYieldStar(this);
  }
}

class Statement extends Ast {}

class ExpressionStatement extends Statement {
  constructor(token, expr) {
    super(token);
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitExpressionStatement(this);
  }
}

class FunctionStatement extends Statement {
  constructor(token, decorators, nam, arglist, bod, isGen, isAsync, vars) {
    super(token);
    this.decorators = decorators;  // [Expression]
    this.nam = nam;  // string
    this.arglist = arglist;  // ArgumentList
    this.bod = bod;  // Block
    this.isGen = isGen;  // bool
    this.isAsync = isAsync;  // bool
    if (isGen && isAsync) {
      throw new SlumberError(
          'Async functions cannot also be generators', token);
    }
    this.vars = vars;  // [string]
  }

  accep(visitor) {
    return visitor.visitFunctionStatement(this);
  }
}

class ClassStatement extends Statement {
  constructor(token, nam, bases, methods) {
    super(token);
    this.nam = nam;  // string
    this.bases = bases;  // [Expression]
    this.methods = methods;  // [FunctionStatement]
  }

  accep(visitor) {
    return visitor.visitClassStatement(this);
  }
}

class Pass extends Statement {
  accep(visitor) {
    return visitor.visitPass(this);
  }
}

class Sync extends Statement {
  constructor(token, bod) {
    super(token);
    this.bod = bod;  // Block
  }

  accep(visitor) {
    return visitor.visitSync(this);
  }
}

class If extends Statement {
  constructor(token, pairs, other) {
    super(token);
    this.pairs = pairs;  // [(Expression, Block)]
    this.other = other;  // Block|undefined
  }

  accep(visitor) {
    return visitor.visitIf(this);
  }
}

class While extends Statement {
  constructor(token, cond, bod) {
    super(token);
    this.cond = cond;  // Expression
    this.bod = bod;  // Block
  }

  accep(visitor) {
    return visitor.visitWhile(this);
  }
}

class For extends Statement {
  constructor(token, nam, expr, bod) {
    super(token);
    this.nam = nam;  // string
    this.expr = expr;  // Expression
    this.bod = bod;  // Block
  }

  accep(visitor) {
    return visitor.visitFor(this);
  }
}

class Break extends Statement {
  accep(visitor) {
    return visitor.visitBreak(this);
  }
}

class Continue extends Statement {
  accep(visitor) {
    return visitor.visitContinue(this);
  }
}

class Return extends Statement {
  constructor(token, expr) {
    super(token);
    this.expr = expr;  // Expression
  }

  accep(visitor) {
    return visitor.visitReturn(this);
  }
}

class Import extends Statement {
  constructor(token, uri, nam) {
    super(token);
    this.uri = uri;  // string
    this.nam = nam;  // string|undefined
  }

  accep(visitor) {
    return visitor.visitImport(this);
  }
}

////// Parser
// predictive parser

class Parser {
  constructor(src) {
    if (!(src instanceof Source)) {
      throw new Error('Parser requires an instance of Source');
    }
    this.src = src;
    this.tokens = lex(src);
    this.cursor = 0;
    this.peek = this.tokens[0];
    this.imports = new Set();
    this.scopeStack = [];
  }

  pushScopeStack() {
    this.scopeStack.push(new Set());
  }

  popScopeStack() {
    return this.scopeStack.pop();
  }

  declareVariable(s) {
    this.scopeStack[this.scopeStack.length-1].add(s);
  }

  declareImport(uri) {
    this.imports.add(uri);
  }

  gettok() {
    let token = this.peek;
    this.cursor++;
    this.peek = this.tokens[this.cursor];
    return token;
  }

  at(t) {
    return t === this.peek.typ;
  }

  consume(t) {
    if (this.at(t)) {
      return this.gettok();
    }
  }

  expect(t) {
    if (!this.at(t)) {
      throw new SlumberError(
          'Expected ' + t + ' but found ' + this.peek.typ, this.peek);
    }
    return this.gettok();
  }

  // rules

  skipNewlines() {
    while (this.consume('NEWLINE'));
  }

  parseFileInput() {
    let token = this.peek;
    let stmts = [];
    this.pushScopeStack();
    this.skipNewlines();
    while (!this.at('EOF')) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    let vars = Array.from(this.popScopeStack());
    return new FileInput(token, stmts, Array.from(this.imports), vars);
  }

  parseBlock() {
    let token = this.peek;
    let stmts = [];
    this.skipNewlines();
    this.expect('INDENT');
    while (true) {
      this.skipNewlines();
      if (this.consume('DEDENT')) {
        break;
      }
      stmts.push(this.parseStatement());
      if (stmts[stmts.length-1] instanceof Pass) {
        stmts.pop();
      }
    }
    this.skipNewlines();
    return new Block(token, stmts);
  }

  parseArgumentList() {
    let token = this.peek;
    let args = [];
    let optargs = [];
    let vararg;
    let texprs = [];
    while (this.at('NAME')) {
      let name = this.expect('NAME').val;
      this.declareVariable(name);
      args.push(name);
      if (this.consume(':')) {
        texprs.push(this.parseExpression());
      } else {
        texprs.push(undefined);
      }
      this.consume(',');
    }
    while (this.consume('/')) {
      let name = this.expect('NAME').val;
      this.declareVariable(name);
      optargs.push(name);
      if (this.consume(':')) {
        texprs.push(this.parseExpression());
      } else {
        texprs.push(undefined);
      }
      this.consume(',');
    }
    if (this.consume('*')) {
      vararg = this.expect('NAME').val;
      this.declareVariable(vararg);
    }
    return new ArgumentList(token, args, optargs, vararg, texprs);
  }

  atExpressionDelimiter() {
    switch(this.peek.typ) {
    case ')':
    case ']':
    case 'NEWLINE':
      return true;
    }
    return false;
  }

  parseExpressionList() {
    let token = this.peek;
    let exprs = [];
    let vararg;
    while (!this.atExpressionDelimiter()) {
      if (this.consume('*')) {
        vararg = this.parseExpression();
        break;
      }
      exprs.push(this.parseExpression());
      if (!this.atExpressionDelimiter()) {
        this.expect(',');
      }
    }
    return new ExpressionList(token, exprs, vararg);
  }

  parseExpression() {
    return this.parseConditionalExpression();
  }

  parseConditionalExpression() {
    let expr = this.parseOrExpression();
    let token = this.peek;
    if (this.consume('if')) {
      let cond = this.parseExpression();
      this.expect('else');
      let rhs = this.parseConditionalExpression();
      return new Ternary(token, cond, expr, rhs);
    }
    return expr;
  }

  parseOrExpression() {
    let expr = this.parseAndExpression();
    let token = this.peek;
    while (this.consume('or')) {
      rhs = this.parseAndExpression();
      expr = new Or(token, expr, rhs);
      token = this.peek;
    }
    return expr;
  }

  parseAndExpression() {
    let expr = this.parseNotExpression();
    let token = this.peek;
    while (this.consume('and')) {
      rhs = this.parseNotExpression();
      expr = new And(token, expr, rhs);
      token = this.peek;
    }
    return expr;
  }

  parseNotExpression() {
    let token = this.consume('not');
    if (token) {
      return new Not(token, this.parseComparisonExpression());
    } else {
      return this.parseComparisonExpression();
    }
  }

  parseComparisonExpression() {
    // TODO: Python style chained comparisons.
    let expr = this.parseAdditiveExpression();
    let token = this.peek;

    if (this.consume('<')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__lt', [rhs]);
    }

    if (this.consume('<=')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__le', [rhs]);
    }

    if (this.consume('>')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__gt', [rhs]);
    }

    if (this.consume('>=')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__ge', [rhs]);
    }

    if (this.consume('==')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__eq', [rhs]);
    }

    if (this.consume('!=')) {
      let rhs = this.parseAdditiveExpression();
      return operatorCall(token, expr, '__ne', [rhs]);
    }

    return expr;
  }

  parseAdditiveExpression() {
    let expr = this.parseMultiplicativeExpression();
    while (true) {
      let token = this.peek;

      if (this.consume('+')) {
        let rhs = this.parseMultiplicativeExpression();
        expr = operatorCall(token, expr, '__add', [rhs]);
        continue;
      }

      if (this.consume('-')) {
        let rhs = this.parseMultiplicativeExpression();
        expr = operatorCall(token, expr, '__sub', [rhs]);
        continue;
      }

      break;
    }
    return expr;
  }

  parseMultiplicativeExpression() {
    let expr = this.parsePrefixExpression();
    while (true) {
      let token = this.peek;

      if (this.consume('*')) {
        let rhs = this.parsePrefixExpression();
        expr = operatorCall(token, expr, '__mul', [rhs]);
        continue;
      }

      if (this.consume('/')) {
        let rhs = this.parsePrefixExpression();
        expr = operatorCall(token, expr, '__div', [rhs]);
        continue;
      }

      if (this.consume('//')) {
        let rhs = this.parsePrefixExpression();
        expr = operatorCall(token, expr, '__floordiv', [rhs]);
        continue;
      }

      if (this.consume('%')) {
        let rhs = this.parsePrefixExpression();
        expr = operatorCall(token, expr, '__mod', [rhs]);
        continue;
      }

      break;
    }
    return expr;
  }

  parsePrefixExpression() {
    let expr = this.parsePrimaryExpression();
    while (true) {
      let token = this.peek;

      if (this.consume('(')) {
        let args = this.parseExpressionList();
        this.expect(')');
        expr = new MethodCall(token, expr, '__call', args);
        continue;
      }

      if (this.consume('.')) {
        let name = this.expect('NAME').val;
        if (this.consume('(')) {
          let args = this.parseExpressionList();
          this.expect(')');
          expr = new MethodCall(token, expr, name, args);
        } else if (this.consume('=')) {
          let value = this.parseExpression();
          expr = new SetAttribute(token, expr, name, value);
        } else {
          expr = new GetAttribute(token, expr, name);
        }
        continue;
      }

      if (this.consume('[')) {
        let arg = this.parseExpression();
        this.expect(']');
        if (this.consume('=')) {
          let val = this.parseExpression();
          expr = operatorCall(token, expr, '__setitem', [arg, val]);
        } else {
          expr = operatorCall(token, expr, '__getitem', [arg]);
        }
        continue;
      }
      break;
    }
    return expr;
  }

  parsePrimaryExpression() {
    let token = this.peek;

    if (this.consume('NUMBER')) {
      return new NumberLiteral(token, token.val);
    }

    if (this.consume('STRING')) {
      return new StringLiteral(token, token.val);
    }

    if (this.consume('NAME')) {
      let name = token.val;
      if (this.consume('=')) {
        this.declareVariable(name);
        let expr = this.parseExpression();
        return new SimpleAssignment(token, name, expr);
      } else {
        return new Name(token, name);
      }
    }

    if (this.consume('self')) {
      return new Self(token);
    }

    if (this.consume('super')) {
      this.expect('.');
      let name = this.expect('NAME').val;
      this.expect('(');
      let exprlist = this.parseExpressionList();
      this.expect(')');
      return new SuperMethodCall(token, name, exprlist);
    }

    if (this.consume('(')) {
      let expr = this.parseExpression();
      this.expect(')');
      return expr;
    }

    if (this.consume('[')) {
      let exprlist = this.parseExpressionList();
      this.expect(']');
      return new ListDisplay(token, exprlist);
    }

    if (this.consume('\\')) {
      this.pushScopeStack();
      let arglist = this.parseArgumentList();
      this.expect('.');
      let expr = this.parseExpression();
      let vars = Array.from(this.popScopeStack());
      return new Lambda(token, arglist, expr, vars);
    }

    if (this.consume('yield')) {
      if (this.consume('*')) {
        let e = this.parseExpression();
        return new YieldStar(token, e);
      } else {
        let e = this.parseExpression();
        return new Yield(token, e);
      }
    }

    throw new SlumberError(
        'Expected expression but found ' + this.peek.typ, this.peek);
  }

  parseStatement() {
    let token = this.peek;

    if (this.consume('pass')) {
      this.expect('NEWLINE');
      return new Pass(token);
    }

    if (this.consume('import')) {
      if (this.scopeStack.length > 1) {
        throw new SlumberError(
            "import statements are only allowed in global scope", token);
      }
      let uri = this.expect('STRING').val;
      let name;
      if (this.consume('as')) {
        name = this.expect('NAME').val;
      }
      this.expect('NEWLINE');
      this.declareImport(uri);
      this.declareVariable(name);
      return new Import(token, uri, name);
    }

    if (this.consume('sync')) {
      this.expect('NEWLINE');
      let body = this.parseBlock();
      return new Sync(token, body);
    }

    if (this.consume('if')) {
      let cond = this.parseExpression();
      this.expect('NEWLINE');
      let body = this.parseBlock();
      let pairs = [[cond, body]];
      let other;
      while (this.consume('elif')) {
        let cond = this.parseExpression();
        this.expect('NEWLINE');
        let body = this.parseBlock();
        pairs.push([cond, body]);
      }
      if (this.consume('else')) {
        this.expect('NEWLINE');
        other = this.parseBlock();
      }
      return new If(token, pairs, other);
    }

    if (this.consume('while')) {
      let cond = this.parseExpression();
      this.expect('NEWLINE');
      let body = this.parseBlock();
      return new While(token, cond, body);
    }

    if (this.consume('for')) {
      let name = this.expect('NAME').val;
      this.declareVariable(name);
      this.expect('in');
      let cont = this.parseExpression();
      this.expect('NEWLINE');
      let body = this.parseBlock();
      return new For(token, name, cont, body);
    }

    if (this.consume('break')) {
      return new Break(token);
    }

    if (this.consume('continue')) {
      return new Continue(token);
    }

    if (this.consume('return')) {
      let e = this.parseExpression();
      this.expect('NEWLINE');
      return new Return(token, e);
    }

    if (this.at('@') || this.at('async') || this.at('def')) {
      let decorators = [];
      while (this.consume('@')) {
        decorators.push(this.parseExpression());
        this.expect('NEWLINE');
      }
      this.pushScopeStack();
      let isAsync = !!this.consume('async');
      this.expect('def');
      let isGen = !!this.consume('*');
      let name = this.expect('NAME').val;
      this.expect('(');
      let arglist = this.parseArgumentList();
      this.expect(')');
      let block = this.parseBlock();
      let vars = Array.from(this.popScopeStack());
      this.declareVariable(name);
      return new FunctionStatement(
          token, decorators, name, arglist, block, isGen, isAsync, vars);
    }

    if (this.consume('class')) {
      let name = this.expect('NAME').val;
      let bases = [];
      if (this.consume('(')) {
        if (!this.at(')')) {
          bases.push(this.parseExpression());
        }
        while (!this.consume(')')) {
          this.expect(',');
          bases.push(this.parseExpression());
        }
      }
      this.pushScopeStack();
      this.expect('NEWLINE');
      this.expect('INDENT');
      let methods = [];
      while (!this.consume('DEDENT')) {
        methods.push(this.parseStatement());
        if (methods[methods.length-1] instanceof Pass) {
          methods.pop();
        } else if (
            !(methods[methods.length-1] instanceof FunctionStatement)) {
          throw new SlumberError(
              'Expected method', methods[methods.length-1].token);
        }
      }
      this.popScopeStack();
      this.declareVariable(name);
      return new ClassStatement(token, name, bases, methods);
    }

    let e = this.parseExpression();
    this.skipNewlines();
    return new ExpressionStatement(token, e);
  }
}

function parse(src) {
  return new Parser(src).parseFileInput();
}

function test() {
function assert(condition, message) {
  if (!condition) {
    message = message ? message : 'assertion error';
    throw new SlumberError(message);
  }
}

function consoleLog() {
  console.log.apply(null, arguments);
}

function runAndCatch(f) {
  try {
    return f();
  } catch (e) {
    if (e instanceof SlumberError) {
      consoleLog(e.toStringWithoutJavascriptTrace());
    } else {
      consoleLog(e.toString());
    }
    throw e;
  }
}

function runTest(f) {
  return runAndCatch(f);
}

// simple source tests
{
  let src = new Source('<test>', 'abc');
  let token = new Token(src, 1, 'typ', 'val');
  let r = token.toString();
  assert(r === 'Token(source, 1, typ, val)', r);
  r = token.getLocationMessage();
  assert(r === `
File "<test>", line 1
abc
 *`, r);
}

// trivial lexer test
{
  let dat = `
`;
  let src = new Source('<test>', dat);
  let tokens = lex(src);
  assert(tokens.length === 1, tokens.length);
  assert(tokens[0].typ === 'EOF', tokens[0].typ);
}

// simple lexer test
{
  let dat = `
while True:
  'hello\\n world' 5 4.4 x.y # hoi
# fun`;
  let src = new Source('<lexer test>', dat);
  let tokens = lex(src);
  assert(tokens.length === 14, tokens.length);

  assert(tokens[0].typ === 'while', tokens[0].typ);

  assert(tokens[1].typ === 'True', tokens[1].typ);

  assert(tokens[2].typ === ':', tokens[2].typ);

  assert(tokens[3].typ === 'NEWLINE', tokens[3].typ);

  assert(tokens[4].typ === 'INDENT', tokens[4].typ);

  assert(tokens[5].typ === 'STRING', tokens[5].typ);
  assert(tokens[5].val === 'hello\n world', tokens[5].val);

  assert(tokens[6].typ === 'NUMBER', tokens[6].typ);
  assert(tokens[6].val === 5, tokens[6].val);

  assert(tokens[7].typ === 'NUMBER', tokens[7].typ);
  assert(tokens[7].val === 4.4, tokens[7].val);

  assert(tokens[8].typ === 'NAME', tokens[8].typ);
  assert(tokens[8].val === 'x', tokens[8].val);

  assert(tokens[9].typ === '.', tokens[9].typ);

  assert(tokens[10].typ === 'NAME', tokens[10].typ);
  assert(tokens[10].val === 'y', tokens[10].val);

  assert(tokens[11].typ === 'NEWLINE', tokens[11].typ);

  assert(tokens[12].typ === 'DEDENT', tokens[12].typ);

  assert(tokens[13].typ === 'EOF', tokens[13].typ);
}

// simple parser test
{
  let dat = `
hello
5
if a
  b
elif c
  d
else
  e
`;
  let src = new Source('<parser test>', dat);
  let r = runTest(() => parse(src));
  // for now just be ok that it doesn't throw, and inspect
  // results by hand as necessary with toString.
}

console.log('slumber_parser tests pass!');
}

if (require.main === module) {
  test();
}

exports.test = test;
exports.Source = Source;
exports.parse = parse;
