var chai = require('chai');
var expect = chai.expect;
var chaiSubset = require('chai-subset');
var parser = require('./grammar.js');
chai.use(chaiSubset);


describe("Parser", function() {
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
});
