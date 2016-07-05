{
  function makeLoc(rawLoc, opts) {
    return {
      filename: opts.filename,
      offset: rawLoc.start.offset,
      line: rawLoc.start.line,
      column: rawLoc.start.column,
    }
  }

  function addLoc(node, rawLoc, opts) {
    if (node.loc === undefined) {
      node.loc = makeLoc(rawLoc, opts);
    }
    return node;
  }

  function makeBinaryOperation(lhs, op, rhs) {
    var name, isLogical = false;
    switch (op) {
    case '+': name = '__add__'; break;
    case '-': name = '__sub__'; break;
    case '*': name = '__mul__'; break;
    case '/': name = '__div__'; break;
    case '%': name = '__mod__'; break;
    case '<': name = '__lt__'; break;
    case '>': name = '__gt__'; break;
    case '<=': name = '__le__'; break;
    case '>=': name = '__ge__'; break;
    case '==': name = '__eq__'; break;
    case '!=': name = '__ne__'; break;
    case 'or': name = 'Or', isLogical = true; break;
    case 'and': name = 'And', isLogical = true; break;
    default: throw new Error("Invalid binary op: " + op);
    }
    if (isLogical) {
      return {type: name, lhs: lhs, rhs: rhs};
    } else {
      return {
          type: "MethodCall",
          owner: lhs,
          name: name,
          args: [rhs],
      };
    }
  }
}

// Normally we only want to use the 'Module' rule to start,
// but for testing we want to be able to parse smaller parts
// of the grammar.
start
  = &{ return options.start === 'Expression'; } e:Expression { return e; }
  / &{ return options.start === 'Statement'; } s:Statement { return s; }

/**
 * Statement
 */

Statement
  = s:StatementWithoutLocData { return addLoc(s, location(), options); }

StatementWithoutLocData
  = expr:Expression ';' _ {
      return { type: "ExpressionStatement", expr: expr };
    }
  / _ ReturnToken expr:Expression ';' _ {
      return { type: "Return", expr: expr };
    }
  / _ BreakToken _ ';' _ { return {type: "Break"}; }
  / _ ContinueToken _ ';' _ { return {type: "Continue"}; }
  / Block
  / _ WhileToken cond:Expression body:Block {
      return {type: "While", cond: cond, body: body};
    }
  / If

Block
  = _ "{" ss:Statement* "}" _ {
      return addLoc({type: "Block", stmts:ss}, location(), options);
    }

If
  = _ IfToken cond:Expression body:Block ElseToken _ other:If {
      return addLoc({type: "If", cond:cond, body:body, other:other},
                    location(), options);
    }
  / _ IfToken cond:Expression body:Block ElseToken _ other:Block {
      return addLoc({type: "If", cond:cond, body:body, other:other},
                    location(), options);
    }
  / _ IfToken cond:Expression body:Block {
      return addLoc({type: "If", cond:cond, body:body},
                    location(), options);
    }

/**
 * Expression
 */

ExpressionList
  = head:Expression tail:("," e:Expression { return e; })* ","? _ {
      return [head].concat(tail);
    }
  / _ { return []; }

Expression
  = expr:Conditional { return addLoc(expr, location(), options); }

Conditional
  = cond:Or "?" expr:Or ":" other:Conditional {
      return {
          type: "Conditional",
          cond: cond, expr: expr, other: other,
      };
    }
  / Or

Or
  = lhs:And ops:(OrToken And)* {
      var expr = lhs, i;
      for (i = 0; i < ops.length; i++) {
        expr = makeBinaryOperation(expr, ops[i][0], ops[i][1]);
      }
      return expr;
    }

And
  = lhs:Not ops:(AndToken Not)* {
      var expr = lhs, i;
      for (i = 0; i < ops.length; i++) {
        expr = makeBinaryOperation(expr, ops[i][0], ops[i][1]);
      }
      return expr;
    }

Not
  = NotToken expr:Relational { return {type: "Not", expr: expr}; }
  / Relational

Relational
  = lhs:Additive ops:(RelationalOperator Additive)* {
      var expr = lhs, i;
      for (i = 0; i < ops.length; i++) {
        expr = makeBinaryOperation(expr, ops[i][0], ops[i][1]);
      }
      return expr;
    }

RelationalOperator
  = "<="
  / ">="
  / "<"
  / ">"
  / "=="
  / "!="

Additive
  = lhs:Multiplicative ops:(AdditiveOperator Multiplicative)* {
      var expr = lhs, i;
      for (i = 0; i < ops.length; i++) {
        expr = makeBinaryOperation(expr, ops[i][0], ops[i][1]);
      }
      return expr;
    }

AdditiveOperator
  = $("+" ![+=])
  / $("-" ![-=])

Multiplicative
  = lhs:Prefix ops:(MultiplicativeOperator Prefix)* {
      var expr = lhs, i;
      for (i = 0; i < ops.length; i++) {
        expr = makeBinaryOperation(expr, ops[i][0], ops[i][1]);
      }
      return expr;
    }

MultiplicativeOperator
  = $("*" !"=")
  / $("/" !"=")
  / $("%" !"=")

Prefix
  = _ op:PrefixOperator owner:Postfix {
      var name;
      switch (op) {
      case '+': name = '__pos__'; break;
      case '-': name = '__neg__'; break;
      default: throw new Error('<unknown-prefix-op>: ' + op);
      }
      return {type: "MethodCall", owner: owner, name: name, args: []};
    }
  / Postfix

PrefixOperator
  = $("+" !"=")
  / $("-" !"=")

Postfix
  = owner:Primary _ "." _ name:RawName _ "(" args:ExpressionList ")" _ {
      return {type: "MethodCall", owner: owner, name: name, args: args};
    }
  / owner:Primary _ "." _ name:RawName _ EQ expr: Expression {
      return {type: "SetAttribute", owner: owner, name: name, expr: expr};
    }
  / owner:Primary _ "." _ name:RawName _ {
      return {type: "GetAttribute", owner: owner, name: name};
    }
  / owner:Primary _ "[" key:Expression "]" _ EQ val:Expression {
      return {
          type: "MethodCall", owner:owner, name:"__setitem__",
          args: [key, val],
      };
    }
  / owner:Primary _ "[" key:Expression "]" _ {
      return {
          type: "MethodCall", owner:owner, name:"__getitem__",
          args: [key],
      };
    }
  / Primary

Primary = _ expr:PrimaryWithoutSpaces _ { return expr; }

PrimaryWithoutSpaces
  = Float
  / Int
  / String
  / name:RawName _ EQ expr:Expression {
      return { type: 'Assign', name: name, expr: expr };
    }
  / Name
  / "(" expr:Expression ")" { return expr; }
  / "[" exprs:ExpressionList "]" {
      return { type: 'List', exprs: exprs };
    }
  / NullToken { return { type: 'Null' }; }
  / ThisToken { return { type: 'This' }; }
  / TrueToken { return { type: 'True' }; }
  / FalseToken { return { type: 'False' }; }
  / SuperToken _ "." _ name:RawName _ "(" args:ExpressionList ")" {
      return { type: 'SuperCall', name: name, args: args};
    }
  / owner:Typename _ "(" args:ExpressionList ")" {
      return {type: 'New', owner: owner, args: args};
    }
  / owner:Typename _ "." _ name:RawName _ "(" args:ExpressionList ")" {
      return {
          type: 'StaticMethodCall', owner: owner, name: name, args: args
      };
    }
  / owner:Typename _ "." _ name:RawName _ EQ expr:Expression {
      return {
          type: 'SetStaticAttribute', owner: owner, name: name, expr: expr
      };
    }
  / owner:Typename _ "." _ name:RawName {
      return { type: 'GetStaticAttribute', owner: owner, name: name};
    }

/**
 * "Tokens"
 */

EQ = $("=" !"=")
EQ2 = $("==")

Name
  = val:RawName { return { type: 'Name', name: val }; }

NameCharacter = [0-9A-Za-z_]

NameEnd = !NameCharacter

Keyword
  = ThisToken
  / NullToken
  / TrueToken
  / FalseToken
  / SuperToken
  / NotToken
  / AndToken
  / OrToken
  / ReturnToken
  / BreakToken
  / ContinueToken
  / WhileToken
  / IfToken
  / ElseToken
  / ClassToken
  / ExtendsToken
  / ImplementsToken

ThisToken = $("this" NameEnd)
NullToken = $("null" NameEnd)
TrueToken = $("true" NameEnd)
FalseToken = $("false" NameEnd)
SuperToken = $("super" NameEnd)
NotToken = $("not" NameEnd)
AndToken = $("and" NameEnd)
OrToken = $("or" NameEnd)
ReturnToken = $("return" NameEnd)
BreakToken = $("break" NameEnd)
ContinueToken = $("continue" NameEnd)
WhileToken = $("while" NameEnd)
IfToken = $("if" NameEnd)
ElseToken = $("else" NameEnd)
ClassToken = $("class" NameEnd)
ExtendsToken = $("extends" NameEnd)
ImplementsToken = $("implements" NameEnd)

Typename
  = val:RawTypename { return { type: 'Typename', name: val }; }

RawName
  = !Keyword [a-z_][0-9A-Za-z_]* { return text(); }
  / [A-Z][0-9A-Z_]+ { return text(); }

RawTypename
  = [A-Z][0-9A-Za-z_]*[a-z][0-9A-Za-z_]* { return text(); }
  / [A-Z] { return text(); }

Float
  = [0-9]+ "." [0-9]* { return { type: "Float", val: text() }; }
  / [0-9]* "." [0-9]+ { return { type: "Float", val: text() }; }

Int
  = [0-9]+ { return { type: "Int", val: text() }; }

String
  = '"""' chars:$(!('"""')StringCharacter)* '"""' {
      return { type: "String", val: chars};
    }
  / '"' chars:$(!('"')StringCharacter)* '"' {
      return { type: "String", val: chars};
    }
  / "'''" chars:$(!("'''")StringCharacter)* "'''" {
      return { type: "String", val: chars};
    }
  / "'" chars:$(!("'")StringCharacter)* "'" {
      return { type: "String", val: chars};
    }

StringCharacter
  = !("\\") . { return text(); }
  / "\\" sequence:EscapeSequence { return sequence; }

EscapeSequence
  = "'"
  / '"'
  / "\\"
  / "b"  { return "\b";   }
  / "f"  { return "\f";   }
  / "n"  { return "\n";   }
  / "r"  { return "\r";   }
  / "t"  { return "\t";   }
  / "v"  { return "\x0B"; }   // IE does not recognize "\v".

/**
 * whitespace for delimiting "tokens"
 */

_ = [ \t\r\n\f]*


