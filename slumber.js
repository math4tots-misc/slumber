/* jshint esversion: 6 */
/*
Language Notes:

* TENTATIVE: Naming convention is based on 'permanence' of a value.

  - Final references to immutable values are ALL_CAPS.
  - Final references to mutable values CapitalizedCamelCase.
  - All other values are camelCase.

Following this rule should 'nil', 'true', 'false' be ALLCAPS?

Maybe
  - constants that are data should be ALL_CAPS,
  - declared classes should be CapitalizedCamelCase,
  - and all other names should be camelCase.

This means that e.g. if a function argument is a class, the name of the
argument is camelCase and not CapitalizedCamelCase.

Implementation Notes:

* I try to avoid special attribute names (like 'type').
So for instance when I would normally have used 'type', I use 'typ'.

*/
// Error.stackTraceLimit = Infinity;

////// source

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

////// lexer

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

////// ast

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
  constructor(token, statements) {
    super(token);
    this.bod = new Block(token, statements);
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
  constructor(token, args, optargs, vararg) {
    super(token);
    this.args = args;  // [string]
    this.optargs = optargs;  // [string]
    this.vararg = vararg;  // string|undefined
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
  constructor(token, nam, expr) {
    super(token);
    this.nam = nam;  // string
    this.expr = expr;  // ExpressionList
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
  constructor(token, arglist, expr) {
    super(token);
    this.arglist = arglist;  // ArgumentList
    this.expr = expr;  // Expression
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
  constructor(token, decorators, nam, arglist, bod, isGen, isAsync) {
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
    this.expr = expr;
  }

  accep(visitor) {
    return visitor.visitReturn(this);
  }
}

class Import extends Statement {
  constructor(token, uri, nam) {
    super(token);
    this.uri = uri;
    this.nam = nam;
  }

  accep(visitor) {
    return visitor.visitImport(this);
  }
}

////// parser
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
    this.skipNewlines();
    while (!this.at('EOF')) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    return new FileInput(token, stmts);
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
    while (this.at('NAME')) {
      args.push(this.expect('NAME').val);
      this.consume(',');
    }
    while (this.consume('/')) {
      optargs.push(this.expect('NAME').val);
      this.consume(',');
    }
    if (this.consume('*')) {
      vararg = this.expect('NAME').val;
    }
    return new ArgumentList(token, args, optargs, vararg);
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
        let expr = this.parseExpression();
        return new SimpleAssignment(token, name, expr);
      } else {
        return new Name(token, name);
      }
    }

    if (this.consume('self')) {
      return new Self(token);
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
      let arglist = this.parseArgumentList();
      this.expect('.');
      let expr = this.parseExpression();
      return new Lambda(token, arglist, expr);
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
      let uri = this.expect('STRING').val;
      this.expect('as');
      let name = this.expect('NAME').val;
      this.expect('NEWLINE');
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
      let isAsync = !!this.consume('async');
      this.expect('def');
      let isGen = !!this.consume('*');
      let name = this.expect('NAME').val;
      this.expect('(');
      let arglist = this.parseArgumentList();
      this.expect(')');
      let block = this.parseBlock();
      return new FunctionStatement(
          token, decorators, name, arglist, block, isGen, isAsync);
    }

    if (this.consume('class')) {
      let name = this.expect('NAME').val;
      let bases = [];
      if (this.consume('(')) {
        while (!this.consume(')')) {
          bases.push(this.parseExpression());
        }
      }
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

////// object

function callWithTrace(token, f) {
  try {
    return f();
  } catch (e) {
    if (e instanceof SlumberError) {
      e.addTokenToSlumberTrace(token);
    } else {
      e2 = new SlumberError(e, token);
      e2.stack = e.stack;
      throw e2;
    }
    throw e;
  }
}

function checkargs(args, len) {
  if (args.length !== len) {
    throw new SlumberError(
        'expected ' + len + ' args but got ' + args.length);
  }
}

function checkargsrange(args, a, b) {
  if (args.length < a || args.length > b) {
    throw new SlumberError(
        'expected ' + a + ' to ' + b + ' args but got ' + args.length);
  }
}

function checkargsmin(args, min) {
  if (args.length < min) {
    throw new SlumberError(
        'expected at least ' + min + ' args but got ' + args.length);
  }
}

function checktype(arg, t) {
  if (!arg.isA(t)) {
    throw new SlumberError(
        'expected ' + t.dat.nam + ' but found ' + arg.cls.dat.nam);
  }
}

let objectCount = 0;

class SlumberObject {
  constructor(cls, attrs, dat) {

    if (cls !== null) {
      if (cls.cls !== slClass) {
        throw new SlumberError('SlumberObject requires a Class object');
      }
    }

    // cls should be another SlumberObject whose 'cls' instance is set to
    // 'slClass'. Of course, the exception here is when we construct
    // 'slClass' itself.
    this.cls = cls;

    // attrs contains attributes of this object. The values should always
    // be SlumberObjects.
    this.attrs = attrs !== undefined ? attrs : new Map();

    // dat is for arbitrary javascript values to use as data (e.g. for
    // builtin types).
    this.dat = dat;

    // Unique object identifier
    this.oid = objectCount++;
  }

  hasattr(attributeName) {
    return this.attrs && this.attrs.has(attributeName);
  }

  getattr(attributeName) {
    let attr = this.attrs.get(attributeName);
    if (!attr) {
      throw new SlumberError(
          'No such attribute ' + attributeName + ' for class ' +
          this.cls.dat.nam);
    }
    return attr;
  }

  setattr(attributeName, value) {
    if (!this.attrs) {
      throw new SlumberError(
          'Tried to set attribute on non-settable object (key = ' +
          attributeName + ')');
    }
    this.attrs.set(attributeName, value);
  }

  callm(methodName, args) {
    let mro = this.cls.dat.mro;
    let mroIndex;
    let m;
    for (mroIndex = 0; mroIndex < mro.length; mroIndex++) {
      if (mro[mroIndex].dat.meths.has(methodName)) {
        m = mro[mroIndex].dat.meths.get(methodName);
        break;
      }
    }
    if (m === undefined) {
      throw new SlumberError(
          'No method "' + methodName + '" for class ' +
          this.cls.dat.nam);
    }
    let r = m(this, args, mroIndex);
    if (r === undefined) {
      r = slnil;
    }
    if (!(r instanceof SlumberObject)) {
      throw new SlumberError(
          "Method call didn't return a SlumberObject: " + r +
          "(" + this.cls.dat.nam + "." + methodName + ")");
    }
    return r;
  }

  isA(t) {
    return this.cls.dat.mro.indexOf(t) !== -1;
  }

  toString() {
    let x = this.callm('__str', []);
    if (x.cls !== slString) {
      throw new SlumberError('__str returned a non-string value: ' + x);
    }
    return x.dat;
  }

  inspect() {
    return this.toString();
  }

  [Symbol.iterator]() {
    return this.callm('__iter', []);
  }

  next() {
    let done = !this.callm('__more', []).truthy();
    let value = this.callm('__next', []);
    return {done: done, value: value};
  }

  truthy() {
    let b = this.callm('__bool', []);
    checktype(b, slBool);
    return b.dat;
  }
}

class SlumberModule extends SlumberObject {
  callm(methodName, args) {
    if (this.hasattr(methodName)) {
      return this.getattr(methodName).callm('__call', args);
    }
    return super.callm(methodName, args);
  }
}

let slumberGlobals = Object.create(null);

let SCOPE_PREFIX = 'xxx';

function scopeSet(scope, name, value) {
  scope[SCOPE_PREFIX + name] = value;
}

function scopeGet(scope, name, token) {
  let v = scope[SCOPE_PREFIX + name];
  if (!v) {
    throw new SlumberError('Variable "' + name + '" never set', token);
  }
  return v;
}

function scopeKeys(scope) {
  return Array.from(Object.keys(scope)).map(
      key => key.slice(SCOPE_PREFIX.length));
}

function newScope(scope) {
  return Object.create(scope);
}

function scopeSetFunction(scope, name, f) {
  scopeSet(scope, name, makeFunction(name, f));
}

function addMethod(cls, name, f) {
  if (!cls.dat.isLeaf) {
    throw new SlumberError(
        'You cannot add a method to a class that already has subclasses: ' +
        '(' + cls.dat.nam + '.' + name + ')');
  }
  if (typeof name !== 'string') {
    throw new SlumberError(
        'Method name must be a javascript String but got ' + name);
  }
  if (typeof f !== 'function') {
    throw new SlumberError(
        'Tried to make method from ' + f + ' (' + name + ')');
  }
  if (f.length !== 2) {
    throw new SlumberError(
        'To make a slumber method, the javascript function must ' +
        'accept exactly two arguments: "self" and "args"' +
        '(' + name + ')');
  }
  cls.dat.meths.set(name, f);
}

let slClass = new SlumberObject(null, null, {});
slClass.cls = slClass;
slClass.dat.nam = 'Class';
slClass.dat.meths = new Map();
slClass.dat.bases = [];
slClass.dat.mro = [slClass];
slClass.dat.instantiable = false;
slClass.dat.isLeaf = true;
scopeSet(slumberGlobals, 'Class', slClass);
addMethod(slClass, '__call', (self, args) => {
  // 'maker' is like __new__ in Python.
  if (self.dat.maker) {
    return self.dat.maker(args);
  }
  // If the class has no 'dat.maker' attribute, we want to allocate first
  // then call __init. Since many of the builtins aren't meant to be
  // instantiated by the user, we only instantiate classes that are marked
  // as instantiable this way.
  if (!self.dat.instantiable) {
    throw new SlumberError('Class ' + self.dat.nam + ' is not instantiable');
  }
  let x = new SlumberObject(self);
  x.callm('__init', args);
  return x;
});
addMethod(slClass, '__repr', (self, args) => {
  checkargs(args, 0);
  return makeString('<Class ' + self.dat.nam + '>');
});
addMethod(slClass, 'getMro', (self, args) => {
  checkargs(args, 0);
  return makeList(Array.from(self.dat.mro));
});

function makeClass(name, bases, instantiable) {
  let cls = new SlumberObject(slClass, null, {});
  if (bases === undefined) {
    bases = [slObject];
  }

  // TODO: multiple inheritance with C3 linearization (as in Python).
  if (bases.length > 1) {
    throw new SlumberError('Multiple inheritance is not yet supported');
  }

  cls.dat.nam = name;
  cls.dat.meths = new Map();
  cls.dat.bases = [];
  cls.dat.isLeaf = true;
  cls.dat.instantiable = instantiable;
  for (let base of bases) {
    if (!(base instanceof SlumberObject) || base.cls !== slClass) {
      throw new SlumberError(
          'Base classes must be "Class" objects but found ' + base);
    }
    base.dat.isLeaf = false;
    cls.dat.bases.push(base);
  }

  cls.dat.mro = [cls];
  if (bases.length > 0) {
    cls.dat.mro = cls.dat.mro.concat(bases[0].dat.mro);
  }

  return cls;
}


let slObject = makeClass('Object', []);
scopeSet(slumberGlobals, 'Object', slObject);
addMethod(slObject, '__init', (self, args) => {
  checkargs(args, 0);
});
addMethod(slObject, '__repr', (self, args) => {
  checkargs(args, 0);
  return makeString('<' + self.cls.dat.nam + ' id=' + self.oid + '>');
});
addMethod(slObject, '__str', (self, args) => {
  return self.callm('__repr', args);
});
addMethod(slObject, '__eq', (self, args) => {
  checkargs(args, 1);
  return self === args[0] ? sltrue : slfalse;
});
addMethod(slObject, '__ne', (self, args) => {
  return self.callm('__eq', args).truthy() ? slfalse : sltrue;
});


slClass.dat.bases.push(slObject);
slClass.dat.mro.push(slObject);


let slNil = makeClass('Nil');
let slnil = new SlumberObject(slNil, null);
scopeSet(slumberGlobals, 'Nil', slNil);
scopeSet(slumberGlobals, 'nil', slnil);
addMethod(slNil, '__repr', (self, args) => {
  checkargs(args, 0);
  return makeString('nil');
});


let slBool = makeClass('Bool');
let sltrue = new SlumberObject(slBool, null, true);
let slfalse = new SlumberObject(slBool, null, false);
scopeSet(slumberGlobals, 'Bool', slBool);
scopeSet(slumberGlobals, 'true', sltrue);
scopeSet(slumberGlobals, 'false', slfalse);
addMethod(slBool, '__repr', (self, args) => {
  return makeString(self.dat ? 'true' : 'false');
});
addMethod(slBool, '__bool', (self, args) => {
  return self;
});


let slNumber = makeClass('Number');
function makeNumber(dat) {
  if (typeof dat !== 'number') {
    throw new SlumberError('Tried to make number from ' + dat);
  }
  if (isNaN(dat)) {
    throw new SlumberError('Tried to make a NaN');
  }
  return new SlumberObject(slNumber, null, dat);
}
scopeSet(slumberGlobals, 'Number', slNumber);
addMethod(slNumber, '__add', (self, args) => {
  checkargs(args, 1);
  checktype(args[0], slNumber);
  return makeNumber(self.dat + args[0].dat);
});
addMethod(slNumber, '__repr', (self, args) => {
  checkargs(args, 0);
  return makeString(self.dat.toString());
});
addMethod(slNumber, '__bool', (self, args) => {
  checkargs(args, 0);
  return self.dat !== 0 ? sltrue : slfalse;
});
addMethod(slNumber, '__eq', (self, args) => {
  checkargs(args, 1);
  return args[0].isA(slNumber) && self.dat === args[0].dat ? sltrue : slfalse;
});


let slString = makeClass('String');
function makeString(dat) {
  if (typeof dat !== 'string') {
    throw new SlumberError('Tried to make string from ' + dat);
  }
  return new SlumberObject(slString, null, dat);
}
scopeSet(slumberGlobals, 'String', slString);
addMethod(slString, '__add', (self, args) => {
  checkargs(args, 1);
  checktype(args[0], slString);
  return makeString(self.dat + args[0].dat);
});
addMethod(slString, '__str', (self, args) => {
  checkargs(args, 0);
  return self;
});
addMethod(slString, '__repr', (self, args) => {
  checkargs(args, 0);
  return makeString(escapeString(self.dat));
});
addMethod(slString, '__eq', (self, args) => {
  checkargs(args, 1);
  return args[0].isA(slString) && self.dat === args[0].dat ? sltrue : slfalse;
});


let slList = makeClass('List');
function makeList(dat) {
  if (!Array.isArray(dat)) {
    throw new SlumberError('Tried to make List from ' + dat);
  }
  return new SlumberObject(slList, null, dat);
}
slList.dat.maker = (args) => {
  return makeList(Array.from(args[0]));
};
scopeSet(slumberGlobals, 'List', slList);
addMethod(slList, '__len', (self, args) => {
  checkargs(args, 0);
  return makeNumber(self.dat.length);
});
addMethod(slList, '__repr', (self, args) => {
  checkargs(args, 0);
  let s = '[';
  let comma = false;
  for (let x of self.dat) {
    if (comma) {
      s += ', ';
    }
    s += x.callm('__repr', []).toString();
    comma = true;
  }
  s += ']';
  return makeString(s);
});
addMethod(slList, '__eq', (self, args) => {
  checkargs(args, 1);
  if (!args[0].isA(slList)) {
    return slfalse;
  }
  let xs = self.dat;
  let ys = args[0].dat;
  if (xs.length !== ys.length) {
    return slfalse;
  }
  let len = xs.length;
  for (let i = 0; i < len; i++) {
    if (!xs[i].callm('__eq', [ys[i]]).truthy()) {
      return slfalse;
    }
  }
  return sltrue;
});
addMethod(slList, '__iter', (self, args) => {
  checkargs(args, 0);
  return makeIterator(self.dat[Symbol.iterator]());
});


let slFunction = makeClass('Function');
function makeFunction(name, f) {
  if (typeof name !== 'string') {
    throw new SlumberError(
        'Function names must be a string but found ' + name);
  }
  if (typeof f !== 'function') {
    throw new SlumberError(
        'Tried to make function from ' + f + ' (' + name + ')');
  }
  if (f.length !== 2) {
    throw new SlumberError(
        'To make a slumber function, the javascript function must accept ' +
        'exactly two arguments: "self" and "args"' + ' (' + name + ')');
  }
  return new SlumberObject(slFunction, null, {nam: name, f: f});
}
function makeGenerator(name, f) {
  if (typeof f !== 'function') {
    throw new SlumberError(
        'Tried to make generator from ' + f + ' (' + name + ')');
  }
  if (f.length !== 2) {
    throw new SlumberError(
        'To make a slumber generator, the javascript generator must ' +
        'accept exactly two arguments: "self" and "args"' +
        ' (' + name + ')');
  }
  return makeFunction(name, (self, args) => makeIterator(f(self, args)));
}
scopeSet(slumberGlobals, 'Function', slFunction);
addMethod(slFunction, '__call', (self, args) => {
  return self.dat.f(slnil, args);
});


let slIterator = makeClass('Iterator');
function makeIterator(iter) {
  return new SlumberObject(slIterator, null, {iter: iter});
}
scopeSet(slumberGlobals, 'Iterator', slIterator);
addMethod(slIterator, '__iter', (self, args) => {
  checkargs(args, 0);
  return self;
});
addMethod(slIterator, '__more', (self, args) => {
  checkargs(args, 0);
  if (!self.dat.peek) {
    self.dat.peek = self.dat.iter.next(slnil);
  }
  return !self.dat.peek.done ? sltrue : slfalse;
});
addMethod(slIterator, '__next', (self, args) => {
  checkargsrange(args, 0, 1);
  if (!self.dat.peek) {
    self.dat.peek = self.dat.iter.next(slnil);
  }
  let value = self.dat.peek.value;
  if (!self.dat.peek.done) {
    self.dat.peek = self.dat.iter.next(args.length === 1 ? args[0] : slnil);
  }
  return value;
});

let slModule = makeClass('Module');
function makeModule(uri, scope) {
  let map = new Map();
  for (let key of scopeKeys(scope)) {
    map.set(key, scopeGet(scope, key));
  }
  return new SlumberModule(slModule, map, {uri: uri});
}
scopeSet(slumberGlobals, 'Module', slModule);


scopeSetFunction(slumberGlobals, 'print', (self, args) => {
  checkargs(args, 1);
  console.log(args[0].toString());
});

scopeSetFunction(slumberGlobals, 'assert', (self, args) => {
  checkargsrange(args, 1, 2);
  if (!args[0].truthy()) {
    let message = args.length === 2 ? args[1].toString() : 'assertion error';
    throw new SlumberError(message);
  }
});

scopeSetFunction(slumberGlobals, 'addMethodTo', (self, args) => {
  checkargs(args, 1);
  checktype(args[0], slClass);
  let cls = args[0];
  return makeFunction('addMethodToWrapper', (self, args) => {
    checkargs(args, 1);
    checktype(args[0], slFunction);
    let f = args[0];
    return addMethod(cls, f.dat.f);
  });
});


////// evaluator

function assignArgumentList(scope, arglist, args) {
  if (arglist.vararg) {
    checkargsmin(args, arglist.args.length);
  } else if (arglist.optargs.length > 0) {
    let min = arglist.args.length;
    let max = min + arglist.optargs.length;
    checkargsrange(args, min, max);
  } else {
    checkargs(args, arglist.args.length);
  }
  let bound1 = arglist.args.length;
  let bound2 = Math.min(bound1 + arglist.optargs.length, args.length);
  let i = 0;
  for (; i < bound1; i++) {
    scopeSet(scope, arglist.args[i], args[i]);
  }
  for (let j = 0; i < bound2; i++, j++) {
    scopeSet(scope, arglist.optargs[j], args[i]);
  }
  if (arglist.vararg) {
    scopeSet(scope, arglist.vararg, makeList(args.slice(i)));
  }
}

class Evaluator {
  constructor(scope, isGen) {
    this.scp = scope;
    this.breakFlag = false;
    this.continueFlag = false;
    this.returnFlag = false;
    this.isGen = !!isGen;
  }

  anyControlFlowFlagIsSet() {
    return this.breakFlag || this.continueFlag || this.returnFlag;
  }

  runToCompletion(node) {
    let i = node.accep(this);
    let n = i.next(slnil);
    if (!n.done) {
      throw new SlumberError('Tried to run a generator like a function');
    }
    return n.value;
  }

  *visitFileInput(node) {
    return yield* node.bod.accep(this);
  }

  *visitExpressionList(node) {
    let args = [];
    for (let e of node.exprs) {
      args.push(yield* e.accep(this));
    }
    if (node.varexpr) {
      let vararg = yield* node.varexpr.accep(this);
      for (let arg of vararg) {
        args.push(arg);
      }
    }
    return args;
  }

  *visitBlock(node) {
    for (let stmt of node.stmts) {
      let result = yield* stmt.accep(this);
      if (this.anyControlFlowFlagIsSet()) {
        return result;
      }
    }
    return slnil;
  }

  *visitName(node) {
    if (false) yield slnil;  // JShint complains if there are no yields.
    return scopeGet(this.scp, node.nam, node.token);
  }

  *visitNumberLiteral(node) {
    if (false) yield slnil;  // JShint complains if there are no yields.
    return makeNumber(node.val);
  }

  *visitStringLiteral(node) {
    if (false) yield slnil;  // JShint complains if there are no yields.
    return makeString(node.val);
  }

  *visitListDisplay(node) {
    return makeList(yield* node.exprlist.accep(this));
  }

  *visitLambda(node) {
    if (false) yield slnil;  // JShint complains if there are no yields.
    let scope = this.scp;
    let arglist = node.arglist;
    let expr = node.expr;
    return makeFunction('<lambda>', (self, args) => {
      assignArgumentList(scope, arglist, args);
      return new Evaluator(scope).runToCompletion(expr);
    });
  }

  *visitSimpleAssignment(node) {
    let name = node.nam;
    let value = yield* node.expr.accep(this);
    scopeSet(this.scp, node.nam, value);
    return value;
  }

  *visitGetAttribute(node) {
    let owner = yield* node.owner.accep(this);
    let name = node.nam;
    return callWithTrace(node.token, () => owner.getattr(name));
  }

  *visitYield(node) {
    if (!this.isGen) {
      throw new SlumberError(
          "You can't yield from a non-generator", node.token);
    }
    return yield yield* node.expr.accep(this);
  }

  *visitYieldStar(node) {
    if (!this.isGen) {
      throw new SlumberError(
          "You can't yield from a non-generator", node.token);
    }
    return yield* yield* node.expr.accep(this);
  }

  *visitMethodCall(node) {
    let owner = yield* node.owner.accep(this);
    let name = node.nam;
    let args = yield* node.exprlist.accep(this);
    return callWithTrace(node.token, () => owner.callm(name, args));
  }

  *visitNot(node) {
    return (yield* node.expr.accep(this)).truthy() ? slfalse : sltrue;
  }

  *visitExpressionStatement(node) {
    yield* node.expr.accep(this);
    return slnil;
  }

  *visitFunctionStatement(node) {
    let name = node.nam;
    let body = node.bod;
    let arglist = node.arglist;
    let scope = this.scp;
    let f;
    if (node.isAsync) {
      throw new SlumberError(
          'Async functions are not yet supported', token);
    } else if (node.isGen) {
      f = makeGenerator(name, function*(self, args) {
        let s = newScope(scope);
        scopeSet(s, 'self', self);
        assignArgumentList(scope, arglist, args);
        return yield* body.accep(new Evaluator(s, true));
      });
    } else {
      f = makeFunction(name, (self, args) => {
        let s = newScope(scope);
        scopeSet(s, 'self', self);
        assignArgumentList(scope, arglist, args);
        return new Evaluator(s).runToCompletion(body);
      });
    }
    for (let i = node.decorators.length-1; i >= 0; i--) {
      // TODO: BUGFIX decorators.
      console.log(f);
      let dn = node.decorators[i];
      console.log(dn);
      let decorator = yield* dn;
      f = decorator.callm('__call', [f]);
      console.log(f);
    }
    scopeSet(this.scp, name, f);
    return f;
  }

  *visitClassStatement(node) {
    let name = node.nam;
    let bases = [];
    for (let b of node.bases) {
      bases.push(yield* b);
    }
    if (bases.length === 0) {
      bases.push(slObject);
    }
    let cls = makeClass(name, bases, true);
    let methods = node.methods;
    let scope = this.scp;
    let astToMethod = m => {
      if (m.decorators.length > 0) {
        throw new SlumberError(
            'Decorators on methods not yet supported', m.token);
      }
      if (m.isAsync) {
        throw new SlumberError('Async methods not yet supported', m.token);
      }
      if (m.isGen) {
        return (self, args) => {
          let s = newScope(scope);
          scopeSet(s, 'self', self);
          assignArgumentList(s, m.arglist, args);
          return makeIterator((function*() {
            return yield* m.bod.accep(new Evaluator(s, true));
          })());
        };
      }
      return (self, args) => {
        let s = newScope(scope);
        scopeSet(s, 'self', self);
        assignArgumentList(s, m.arglist, args);
        return new Evaluator(s).runToCompletion(body);
      };
    };
    for (let m of methods) {
      addMethod(cls, m.nam, astToMethod(m));
    }
    scopeSet(scope, name, cls);
    return cls;
  }

  *visitFor(node) {
    for (let x of yield* node.expr.accep(this)) {
      scopeSet(this.scp, node.nam, x);
      let value = yield* node.bod.accep(this);
      if (this.breakFlag) {
        this.breakFlag = false;
        break;
      } else if (this.continueFlag) {
        this.continueFlag = false;
        continue;
      } else if (this.returnFlag) {
        return value;
      }
    }
    return slnil;
  }

  *visitReturn(node) {
    let value = yield* node.expr.accep(this);
    this.returnFlag = true;
    return value;
  }
}

function run(source, scope) {
  if (scope === undefined) {
    scope = newScope(slumberGlobals);
  }
  new Evaluator(scope).runToCompletion(parse(source));
  return makeModule(source.uri, scope);
}

////// prelude

let PRELUDE = `

def len(xs)
  return xs.__len()

def str(x)
  return x.__str()

def repr(x)
  return x.__repr()

def* map(f, xs)
  for x in xs
    yield f(x)

def* range(start, /end)
  if end == nil
    end = start
    start = 0

  i = start
  while i < end
    yield i
    i = i + 1

`;

run(new Source('<prelude>', PRELUDE), slumberGlobals);


////// tests
(function() {
"use strict";

function assert(condition, message) {
  if (!condition) {
    message = message ? message : 'assertion error';
    throw new Error(message);
  }
}

function runTest(f) {
  try {
    return f();
  } catch (e) {
    if (e instanceof SlumberError) {
      console.log(e.toStringWithoutJavascriptTrace());
    } else {
      console.log(e.toString());
    }
    throw e;
  }
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

// simple run test
{
  let dat = `
x = 5
y = x + 7
`;
  let src = new Source('<run test>', dat);
  let m = runTest(() => run(src));
  let x = m.getattr('x');
  assert(x.isA(slNumber), x.cls);
  assert(x.dat === 5, x.dat);
  let y = m.getattr('y');
  assert(y.isA(slNumber), y.cls);
  assert(y.dat === 12, y.dat);
}

// simple run test2
{
  let dat = `

assert(true)
assert(not false)
assert('hi' == 'hi')
assert('a' == 'a')
assert(not ('a' != 'a'))
assert('a' != 'b')

def* f()
  yield 173
  yield 81
  yield 4

i = f()
assert(i.__more())
assert((v = i.__next()) == 173, v)
assert(i.__more())
assert((v = i.__next()) == 81, v)
assert(i.__more())
assert((v = i.__next()) == 4, v)
assert(not i.__more())
assert((v = i.__next()) == nil, v)

def* f()
  yield 173
  yield 81
  yield 4
  yield 4

assert((v = List(f())) == [173, 81, 4, 4], v)
assert((v = List(f())) != [173, 81, 4, 23], v)

assert((v = [1, 2, 3].__len()) == 3, v)
assert((v = len([5, 4, 3, 2, 1])) == 5, v)

def* f()
  yield 'a'
  yield 'b'

def* g()
  yield 0
  yield* f()
  yield 'c'

assert((v = List(g())) == [0, 'a', 'b', 'c'], v)
xs = List(map(\\x. x+1, [1, 2, 3]))
assert(xs == [2, 3, 4], xs)

class C
  def* g()
    yield 14
    yield 18
    return 'hoi'

assert(C.getMro() == [C, Object], C.getMro())
assert(List.getMro() == [List, Object], List.getMro())

assert(str(C) == '<Class C>', str(C))
c = C()
print(List(c.g()))

def* f()
  print(yield* c.g())

List(f())

@addMethodTo(C)
def f()
  print('inside monkey-patched f')

c.f()

# print("simple run test2 pass")
`;
  let src = new Source('<run test>', dat);
  let m = runTest(() => run(src));
}

})();
