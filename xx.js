/* jshint esversion: 6 */

class Lexer {
}

class Parser {
}

function indent(code) {
  return code.replace(/\n/g, '\n  ');
}

class Ast {
  // Ast has three important API methods.
  //   - grok(data)
  //       dump information about class hierarchy, attribute types,
  //       method types and method arg types in the 'data' object,
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

class Module extends Ast {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;  // [GlobalDecl|FuncDef|ClassDef]
  }
  grok(data) {

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
  gen() {
    return '\nlet xx' + name + ' = null;';
  }
}

class FuncDef extends Ast {
  constructor(token, ret, name, argtypes, argnames, body) {
    super(token);
    this.ret = ret;
    this.name = name;
    this.argtypes = argtypes;
    this.argnames = argnames;
    this.body = body;
  }
  gen() {
    return ('\nfunction xx' + this.name +
            '(' + this.argnames.join(",") + ')' +
            this.body.gen());
  }
}

class ClassDef extends Ast {
  constructor(token, name, base, interfs, attrs, methods) {
    super(token);
    this.name = name;  // string
    this.base = base;  // string
    this.interfs = interfs;  // [string]
    this.attrs = attrs;  // [Attr]
    this.methods = methods;  // [Method]
  }
  gen() {
    return ('\nclass xx' + this.name + ' extends xx' + this.base +
            ' {' + indent(
                this.methods.map(method => method.gen()).join("")
            ) + '}');
  }
}

class Statement extends Ast {}

class Block extends Statement {
  constructor(token, stmts) {
    super(token);
    this.stmts = stmts;
  }
  gen() {
    return '\n{' + indent(this.stmts.map(stmt => stmt.gen())) + '}';
  }
}

class ExpressionStatement extends Statement {
  constructor(token, expr) {
    super(token);
    this.expr = expr;
  }
  gen() {
    return '\n' + this.expr.gen() + ';';
  }
}

class Expression extends Ast {}
