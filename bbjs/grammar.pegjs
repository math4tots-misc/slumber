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
}

// Normally we only want to use the 'Module' rule to start,
// but for testing we want to be able to parse smaller parts
// of the grammar.
start
  = &{ return options.start === 'Expression'; } e:Expression { return e; }

Expression
  = expr:Primary { return addLoc(expr, location(), options); }

Primary
  = Float
  / Int
  / String
  / Name
  / "(" expr:Expression ")" { return expr; }

/**
 * "Tokens"
 */

Name
  = val:RawName { return { type: 'Name', val: val }; }

NameCharacter = [0-9A-Za-z_]

NameEnd = !NameCharacter

Keyword
  = ClassToken
  / ExtendsToken
  / ImplementsToken

ClassToken = $("class" NameEnd)
ExtendsToken = $("extends" NameEnd)
ImplementsToken = $("implements" NameEnd)

Typename
  = val:RawTypename { return { type: 'Typename', val: val }; }

RawName
  = !Keyword [a-z_][0-9A-Za-z_]* { return text(); }
  / [A-Z][0-9A-Z_]+ { return text(); }

RawTypename
  = [A-Z][0-9A-Za-z_]*[a-z][0-9A-Za-z_]* { return text(); }

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


