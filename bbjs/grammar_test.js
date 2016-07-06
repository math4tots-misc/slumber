var chai = require('chai');
var expect = chai.expect;
var chaiSubset = require('chai-subset');
var parser = require('./grammar.js');
chai.use(chaiSubset);


describe("Parser", function() {
  describe("when parsing typename", function() {
    var PARSE_OPTS = {
      start: 'Typename',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should accept 'X' (single captial letter -- Type)", function() {
      expect(parse("X")).to.containSubset({type: "Typename", name: "X"});
    });
    it("should accept 'Xx' (single captial letter -- Type)", function() {
      expect(parse("Xx")).to.containSubset({type: "Typename", name: "Xx"});
    });
    it("should reject 'x' (single captial letter -- Name)", function() {
      expect(function() { parse("x"); }).to.throw(Error);
    });
    it("should reject 'XX' (double captial letter -- Constant)", function() {
      expect(function() { parse("XX"); }).to.throw(Error);
    });
  });
  describe("when parsing expression", function() {
    var PARSE_OPTS = {
      start: 'Expression',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse Float", function() {
      expect(parse("5.5")).to.containSubset({
          type: "Float",
          val: '5.5',
      });
    });
    describe("should have location data that", function() {
      var parseResult = parse("5.5", '<sample-filename>');
      it("should be present (property loc)", function() {
        expect(parseResult).to.have.property("loc");
      });
      it("should have line numbers (property line)", function() {
        expect(parseResult.loc).to.have.property("line");
      });
      it("should have column numbers (property column)", function() {
        expect(parseResult.loc).to.have.property("column");
      });
      it("should have offsets (property offset)", function() {
        expect(parseResult.loc).to.have.property("offset");
      });
      it("should have file names (property filename)", function() {
        expect(parseResult.loc).to.have.property(
            "filename", "<sample-filename>");
      });
    });
    it("should parse Int", function() {
      expect(parse("5")).to.containSubset({
          type: "Int",
          val: '5',
      });
    });
    it("should parse This", function() {
      expect(parse("this")).to.containSubset({
          type: "This",
      });
    });
    it("should parse Null", function() {
      expect(parse("null")).to.containSubset({
          type: "Null",
      });
    });
    it("should parse True", function() {
      expect(parse("true")).to.containSubset({
          type: "True",
      });
    });
    it("should parse False", function() {
      expect(parse("false")).to.containSubset({
          type: "False",
      });
    });
    it('should parse string literals with escapes', function() {
      expect(parse('"\\n"')).to.containSubset({
        type: "String",
        val: "\n",
      });
    });
    it('should parse <"""> quoted strings', function() {
      var result = parse('"""hi" \n"""');
      expect(result).to.containSubset({
          type: "String",
          val: 'hi" \n',
      });
      expect(result).to.have.property('loc');
    });
    it('should parse <"> quoted strings', function() {
      expect(parse('"hi"')).to.containSubset({
          type: "String",
          val: 'hi',
      });
    });
    it("should parse <'''> quoted strings", function() {
      expect(parse("'''hoixx ' f'''")).to.containSubset({
          type: "String",
          val: "hoixx ' f",
      });
    });
    it("should parse <'> quoted strings", function() {
      expect(parse("'hoixx f'")).to.containSubset({
          type: "String",
          val: 'hoixx f',
      });
    });
    it("should parse Name", function() {
      expect(parse("hiThere")).to.containSubset({
          type: "Name",
          name: 'hiThere',
      });
    });
    it("should parse Name wrapped in parenthesis", function() {
      expect(parse("(hiThere)")).to.containSubset({
          type: "Name",
          name: 'hiThere',
      });
    });
    it("should parse Name wrapped in parenthesis with spaces", function() {
      expect(parse("( hiThere )")).to.containSubset({
          type: "Name",
          name: 'hiThere',
      });
    });
    it("should reject 'class' as a variable name", function() {
      expect(function() { parse("class"); }).to.throw(Error);
    });
    it("should reject 'X' as a variable name (typename)", function() {
      expect(function() { parse("X"); }).to.throw(Error);
    });
    it("should reject 'Name' as a variable name (typename)", function() {
      expect(function() { parse("Name"); }).to.throw(Error);
    });
    it("should accept names starting with keyword (classes)", function() {
      expect(parse("classes")).to.containSubset({
          type: "Name",
          name: 'classes',
      });
    });
    it("should parse Assign", function() {
      expect(parse("x = 5")).to.containSubset({
          type: "Assign",
          name: 'x',
          expr: {
              type: "Int",
              val: "5",
          }
      });
    });
    it("should parse an empty List", function() {
      expect(parse("[ ]")).to.containSubset({
          type: "List",
          exprs: [],
      });
    });
    it("should parse a List with one item", function() {
      expect(parse("[x]")).to.containSubset({
          type: "List",
          exprs: [{type: "Name", name: "x"}],
      });
    });
    it("should parse a List with many items", function() {
      expect(parse("[1, 2, 3]")).to.containSubset({
          type: "List",
          exprs: [
              {
                type: "Int",
                val: "1",
              },
              {
                type: "Int",
                val: "2",
              },
              {
                type: "Int",
                val: "3",
              },
          ],
      });
    });
    it("should parse SuperCall", function() {
      expect(parse("super.someMethod()")).to.containSubset({
          type: "SuperCall",
          name: 'someMethod',
          args: [],
      });
    });
    it("should parse MethodCall", function() {
      expect(parse("x.someMethod(y)")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Name',
              name: 'x',
          },
          name: 'someMethod',
          args: [
              {
                type: 'Name',
                name: 'y',
              },
          ],
      });
    });
    it("should parse StaticMethodCall", function() {
      expect(parse("X.someMethod(y)")).to.containSubset({
          type: "StaticMethodCall",
          owner: {
              type: 'Typename',
              name: 'X',
          },
          name: 'someMethod',
          args: [
              {
                type: 'Name',
                name: 'y',
              },
          ],
      });
    });
    it("should parse New", function() {
      expect(parse("X(y)")).to.containSubset({
          type: "New",
          owner: {
              type: 'Typename',
              name: 'X',
          },
          args: [
              {
                type: 'Name',
                name: 'y',
              },
          ],
      });
    });
    it("should parse __getitem__ MethodCall", function() {
      expect(parse("x[y]")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Name',
              name: 'x',
          },
          name: '__getitem__',
          args: [
              {
                type: 'Name',
                name: 'y',
              },
          ],
      });
    });
    it("should parse __setitem__ MethodCall", function() {
      expect(parse("x[y] = 7.7")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Name',
              name: 'x',
          },
          name: '__setitem__',
          args: [
              {
                type: 'Name',
                name: 'y',
              },
              {
                type: 'Float',
                val: '7.7',
              },
          ],
      });
    });
    it("should parse GetAttribute", function() {
      expect(parse("x.y")).to.containSubset({
          type: "GetAttribute",
          owner: {
              type: 'Name',
              name: 'x',
          },
          name: 'y',
      });
    });
    it("should parse GetStaticAttribute", function() {
      expect(parse("X.y")).to.containSubset({
          type: "GetStaticAttribute",
          owner: {
              type: 'Typename',
              name: 'X',
          },
          name: 'y',
      });
    });
    it("should parse SetAttribute", function() {
      expect(parse("x.y = 3")).to.containSubset({
          type: "SetAttribute",
          owner: {
              type: 'Name',
              name: 'x',
          },
          name: 'y',
          expr: {
              type: 'Int',
              val: '3',
          },
      });
    });
    it("should parse SetStaticAttribute", function() {
      expect(parse("X.y = 3")).to.containSubset({
          type: "SetStaticAttribute",
          owner: {
              type: 'Typename',
              name: 'X',
          },
          name: 'y',
          expr: {
              type: 'Int',
              val: '3',
          },
      });
    });
    it("should parse __neg__ MethodCall", function() {
      expect(parse("-7.7")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Float',
              val: '7.7',
          },
          name: '__neg__',
          args: [],
      });
    });
    it("should parse __pos__ MethodCall", function() {
      expect(parse("+7.7")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Float',
              val: '7.7',
          },
          name: '__pos__',
          args: [],
      });
    });
    it("should parse __mul__ MethodCall", function() {
      expect(parse("2 * 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__mul__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __div__ MethodCall", function() {
      expect(parse("2 / 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__div__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __mod__ MethodCall", function() {
      expect(parse("2 % 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__mod__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __add__ MethodCall", function() {
      expect(parse("2 + 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__add__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __sub__ MethodCall", function() {
      expect(parse("2 - 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__sub__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __eq__ MethodCall", function() {
      expect(parse("2 == 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__eq__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __ne__ MethodCall", function() {
      expect(parse("2 != 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__ne__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __lt__ MethodCall", function() {
      expect(parse("2 < 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__lt__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __le__ MethodCall", function() {
      expect(parse("2 <= 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__le__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __gt__ MethodCall", function() {
      expect(parse("2 > 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__gt__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse __ge__ MethodCall", function() {
      expect(parse("2 >= 3")).to.containSubset({
          type: "MethodCall",
          owner: {
              type: 'Int',
              val: '2',
          },
          name: '__ge__',
          args: [{type: 'Int', val: '3'}],
      });
    });
    it("should parse Not expression", function() {
      expect(parse("not true")).to.containSubset({
          type: "Not",
          expr: {type: "True"},
      });
    });
    it("should parse And expression", function() {
      expect(parse("true and false")).to.containSubset({
          type: "And",
          lhs: {type: "True"},
          rhs: {type: "False"},
      });
    });
    it("should parse Or expression", function() {
      expect(parse("true or false")).to.containSubset({
          type: "Or",
          lhs: {type: "True"},
          rhs: {type: "False"},
      });
    });
    it("should parse Conditional expression", function() {
      expect(parse("x ? true : false")).to.containSubset({
          type: "Conditional",
          cond: {type: "Name", name: "x"},
          expr: {type: "True"},
          other: {type: "False"},
      });
    });
    it("should respect order of operations in 2 + 3 * 4", function() {
      expect(parse("2 + 3 * 4")).to.containSubset({
          type: "MethodCall",
          name: "__add__",
          owner: {type: "Int", val: "2"},
          args: [
              {
                  type: "MethodCall", name: "__mul__",
                  owner: {type: "Int", val: "3"},
                  args: [{type: "Int", val: "4"}],
              },
          ],
      });
    });
    it("should respect order of operations in (2 + 3) * 4", function() {
      expect(parse("(2 + 3) * 4")).to.containSubset({
          type: "MethodCall",
          name: "__mul__",
          owner: {
              type: "MethodCall", name: "__add__",
              owner: {type: "Int", val: "2"},
              args: [{type: "Int", val: "3"}],
          },
          args: [{type: "Int", val: "4"}],
      });
    });
    it("should respect order of operations in 2 + 3 + 4", function() {
      expect(parse("2 + 3 + 4")).to.containSubset({
          type: "MethodCall",
          name: "__add__",
          owner: {
              type: "MethodCall", name: "__add__",
              owner: {type: "Int", val: "2"},
              args: [{type: "Int", val: "3"}],
          },
          args: [{type: "Int", val: "4"}],
      });
    });
  });

  describe("when parsing statement", function() {
    var PARSE_OPTS = {
      start: 'Statement',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse simple expression statement", function() {
      expect(parse("x;")).to.containSubset({
          type: "ExpressionStatement",
          expr: {type: "Name", name: "x"},
      });
    });
    it("should parse simple return", function() {
      expect(parse("return x;")).to.containSubset({
          type: "Return",
          expr: {type: "Name", name: "x"},
      });
    });
    it("should parse simple break", function() {
      expect(parse("break;")).to.containSubset({
          type: "Break",
      });
    });
    it("should parse simple continue", function() {
      expect(parse("continue;")).to.containSubset({
          type: "Continue",
      });
    });
    it("should parse simple while", function() {
      expect(parse("while true {}")).to.containSubset({
          type: "While",
          cond: {type: "True"},
          body: {
              type: "Block",
              stmts: [],
          }
      });
    });
    it("should parse simple if", function() {
      expect(parse("if true {}")).to.containSubset({
          type: "If",
          cond: {type: "True"},
          body: {
              type: "Block",
              stmts: [],
          },
          other: undefined,
      });
    });
    it("should parse simple if-else", function() {
      expect(parse("if true {} else {}")).to.containSubset({
          type: "If",
          cond: {type: "True"},
          body: {
              type: "Block",
              stmts: [],
          },
          other: {
              type: "Block",
              stmts: [],
          },
      });
    });
    it("should parse simple if-else-if-else", function() {
      expect(parse("if true {} else if false {}")).to.containSubset({
          type: "If",
          cond: {type: "True"},
          body: {
              type: "Block",
              stmts: [],
          },
          other: {
              type: "If",
              cond: {type: "False"},
              body: {
                  type: "Block",
                  stmts: [],
              }
          },
      });
    });
    it("should parse empty block", function() {
      expect(parse("{}")).to.containSubset({
          type: "Block",
          stmts: [],
      });
    });
    it("should parse non-empty block", function() {
      expect(parse("{return x;}")).to.containSubset({
          type: "Block",
          stmts: [
              {
                  type: "Return",
                  expr: {type: "Name", name: "x"},
              },
          ],
      });
    });
  });
  describe("when parsing attribute", function() {
    var PARSE_OPTS = {
      start: 'Attribute',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse static attribute", function() {
      expect(parse("static String x;")).to.containSubset({
          type: "Attribute",
          cls: {
              type: "Typename",
              name: "String",
          },
          name: "x",
          isStatic: true,
      });
    });
    it("should parse non-static attribute", function() {
      expect(parse("String x;")).to.containSubset({
          type: "Attribute",
          cls: {
              type: "Typename",
              name: "String",
          },
          name: "x",
          isStatic: false,
      });
    });
    it("should parse primitive attribute", function() {
      expect(parse("int x;")).to.containSubset({
          type: "Attribute",
          cls: {
              type: "Typename",
              name: "int",
          },
          name: "x",
          isStatic: false,
      });
    });
  });
  describe("when parsing method", function() {
    var PARSE_OPTS = {
      start: 'Method',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse static method with empty body", function() {
      expect(parse("static int f(String y) {}")).to.containSubset({
          type: "Method",
          returns: {
              type: "Typename",
              name: "int",
          },
          name: "f",
          args: [
            [
              {
                type: "Typename",
                name: "String",
              }, "y",
            ],
          ],
          isStatic: true,
          body: {
            type: "Block",
            stmts: [],
          },
      });
    });
    it("should parse non-static method with empty body", function() {
      expect(parse("int f(String y) {}")).to.containSubset({
          type: "Method",
          returns: {
              type: "Typename",
              name: "int",
          },
          name: "f",
          args: [
            [
              {
                type: "Typename",
                name: "String",
              },
              "y",
            ],
          ],
          isStatic: false,
          body: {
            type: "Block",
            stmts: [],
          },
      });
    });
    it("should parse method with no body", function() {
      expect(parse("int f(String y);")).to.containSubset({
          type: "Method",
          returns: {
              type: "Typename",
              name: "int",
          },
          name: "f",
          args: [
            [
              {
                type: "Typename",
                name: "String",
              },
              "y",
            ],
          ],
          isStatic: false,
          body: null,
      });
    });
    it("should parse method with no body but with doc", function() {
      expect(parse("int f(String y); 'fdoc'")).to.containSubset({
          type: "Method",
          returns: {
              type: "Typename",
              name: "int",
          },
          name: "f",
          doc: 'fdoc',
          args: [
            [
              {
                type: "Typename",
                name: "String",
              },
              "y",
            ],
          ],
          isStatic: false,
          body: null,
      });
    });
    it("should parse method with simple body", function() {
      expect(parse("int f(String y) { return 5; }")).to.containSubset({
          type: "Method",
          returns: {
              type: "Typename",
              name: "int",
          },
          name: "f",
          args: [
            [
              {
                type: "Typename",
                name: "String",
              },
              "y",
            ],
          ],
          isStatic: false,
          body: {
            type: "Block",
            stmts: [
              {
                type: "Return",
                expr: {type: "Int", val: "5"},
              }
            ],
          },
      });
    });
    it("should parse method with body and doc", function() {
      var text = "int f(String y) { 'fdoc'; return 5; }";
      expect(parse(text)).to.containSubset({
        type: "Method",
        returns: {
            type: "Typename",
            name: "int",
        },
        name: "f",
        doc: 'fdoc',
        args: [
          [
            {
              type: "Typename",
              name: "String",
            },
            "y",
          ],
        ],
        isStatic: false,
        body: {
          type: "Block",
          stmts: [
            {
              type: "Return",
              expr: {type: "Int", val: "5"},
            }
          ],
        },
      });
    });
  });
  describe("when parsing class", function() {
    var PARSE_OPTS = {
      start: 'Class',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse empty class", function() {
      expect(parse("class Klass {}")).to.containSubset({
          type: "Class",
          name: "Klass",
          kind: "class",
          base: null,
          interfaces: [],
          attrs: [],
          methods: [],
      });
    });
    it("should parse class with docstring", function() {
      expect(parse("class Klass { 'Klass doc' }")).to.containSubset({
        type: "Class",
        name: "Klass",
        doc: 'Klass doc',
      });
    });
    it("should parse class with one attr and one method", function() {
      expect(parse("class Klass { int x; void f() {} }")).to.containSubset({
          type: "Class",
          name: "Klass",
          kind: "class",
          base: null,
          interfaces: [],
          attrs: [
            {
              type: "Attribute",
              cls: {type: "Typename", name: "int"},
              name: "x",
            },
          ],
          methods: [
            {
              type: "Method",
              returns: {type: "Typename", name: "void"},
              name: "f",
              args: [],
              body: {type: "Block", stmts: []},
            }
          ],
      });
    });
  });

  describe("when parsing import", function() {
    var PARSE_OPTS = {
      start: 'Import',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse non-aliased import", function() {
      expect(parse("import a.b.C;")).to.containSubset({
        type: "Import",
        pkg: "a.b",
        name: "C",
        alias: "C",
      });
    });
    it("should parse aliased import", function() {
      expect(parse("import a.b.C as D;")).to.containSubset({
        type: "Import",
        pkg: "a.b",
        name: "C",
        alias: "D",
      });
    });
  });

  it("should parse package declaration", function() {
    var PARSE_OPTS = { start: "Package" };
    expect(parser.parse("package a.b;", PARSE_OPTS)).to.containSubset({
      type: "Package",
      pkg: "a.b",
    });
  });

  describe("when parsing module", function() {
    var PARSE_OPTS = {};
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should parse a simple module with one class", function() {
      var source = `
package local;

import java.util.ArrayList;

class Main {
  static void main() {
    System.out.println("Hello world!");
  }
}
`
      expect(parse(source)).to.containSubset({
        type: "Module",
        imports: [{type: "Import", name: "ArrayList"}],
        classes: [{type: "Class", kind: "class", name: "Main"}],
      });
    });
  });
});
