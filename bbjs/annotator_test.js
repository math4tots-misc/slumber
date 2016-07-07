/* jshint esversion: 6 */

var chai = require('chai');
var expect = chai.expect;
var chaiSubset = require('chai-subset');
var parser = require('./grammar.js');
var TypeInfo = require('./type_info.js').TypeInfo;
var Annotator = require('./annotator.js').Annotator;
chai.use(chaiSubset);

// TODO: Test annotating statements/class/etc. -- test that
// they annotate the expressions in those other constructs.

describe("Annotator", function() {
  var module0 = `
  package bb.lang;

  native Object {}
  native String {}
  native List {}

  `;

  var module1 = `

  package local.one;

  interface Ia {}

  class A implements Ia {
    int x;
    static String a;
    int f(List x);
    static String foo(int a, float b);
  }
  class B extends A {}
  class C extends B {}

  class D extends Object {}

  `;
  var typeInfo = new TypeInfo();

  typeInfo.processAllModules([
    parser.parse(module0),
    parser.parse(module1),
  ]);

  var annotator = new Annotator(typeInfo);

  describe("#annotate (module)", function() {
    it("should annotate a simple well formed module", function() {
      var node = parser.parse(`
      package local.one;

      class A {
        static void main() {
          this.f();
        }
        int f() {
          int x = 5;
          while x < 10 {
            if x < 7 {
              x = x + 2;
            } else {
              x = x + 1;
            }
          }
          return 1 + x;
        }
      }
      `);
      annotator.annotate(node);
    });
  });

  describe("#annotate (expression)", function() {
    var PARSE_OPTS = {
      start: 'Expression',
      package: 'local.one',
    };
    function parse(string, filename) {
      var opts = Object.create(PARSE_OPTS);
      if (filename !== undefined) {
        opts.filename = filename;
      }
      return parser.parse(string, opts);
    }
    it("should annotate new expression", function() {
      var node = parse('A()');
      annotator.annotate(node);
      expect(node.exprType).to.equal('local.one.A');
    });
    it("should annotate method call", function() {
      var node = parse('A().f()');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate static method call", function() {
      var node = parse('A.foo()');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bb.lang.String');
    });
    it("should annotate attribute access", function() {
      var node = parse('B().x');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate static attribute access", function() {
      var node = parse('A.a');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bb.lang.String');
    });
    it("should annotate null", function() {
      var node = parse('null');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bb.lang.Object');
    });
    it("should annotate true", function() {
      var node = parse('true');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bool');
    });
    it("should annotate false", function() {
      var node = parse('false');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bool');
    });
    it("should annotate int literal", function() {
      var node = parse('5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate float literal", function() {
      var node = parse('3.3');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate string literal", function() {
      var node = parse('"Hello world!"');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bb.lang.String');
    });
    it("should annotate list display", function() {
      var node = parse('[1, 2, 3]');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bb.lang.List');
    });
    it("should annotate this", function() {
      var node = parse('this');
      var annotator = new Annotator(typeInfo);
      annotator.setThisType('local.foo.Bar');
      annotator.annotate(node);
      expect(node.exprType).to.equal('local.foo.Bar');
    });
    it("should annotate super method call", function() {
      var node = parse('super.f()');
      var annotator = new Annotator(typeInfo);
      annotator.setThisType('local.one.B');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate Or expression", function() {
      var node = parse('true or false');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bool');
    });
    it("should annotate And expression", function() {
      var node = parse('true and false');
      annotator.annotate(node);
      expect(node.exprType).to.equal('bool');
    });
    it("should annotate Ternary (with primitive switches)", function() {
      var node = parse('true ? 1 : 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate Ternary (with inheritance)", function() {
      var node = parse('true ? A() : B()');
      annotator.annotate(node);
      expect(node.exprType).to.equal('local.one.A');
    });
    it("should annotate assign", function() {
      var node = parse('x = true');
      var annotator = new Annotator(typeInfo);
      annotator.declareVariable('bool', 'x');
      annotator.annotate(node);
      expect(node.exprType).to.equal('local.one.A');
    });
    it("should throw on assign type mismatch", function() {
      var node = parse('x = 5');
      var annotator = new Annotator(typeInfo);
      annotator.declareVariable('bool', 'x');
      expect(function() { annotator.annotate(node); }).to.throw(Error);
    });
    it("should annotate primitive int+float -> float", function() {
      var node = parse('1 + 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float+int -> float", function() {
      var node = parse('2.5 + 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float+float -> float", function() {
      var node = parse('2.76 + 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive int+int -> int", function() {
      var node = parse('1 + 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate primitive int-float -> float", function() {
      var node = parse('1 - 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float-int -> float", function() {
      var node = parse('2.5 - 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float-float -> float", function() {
      var node = parse('2.76 - 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive int-int -> int", function() {
      var node = parse('1 - 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate primitive int*float -> float", function() {
      var node = parse('1 * 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float*int -> float", function() {
      var node = parse('2.5 * 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float*float -> float", function() {
      var node = parse('2.76 * 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive int*int -> int", function() {
      var node = parse('1 * 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate primitive int/float -> float", function() {
      var node = parse('1 / 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float/int -> float", function() {
      var node = parse('2.5 / 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive float/float -> float", function() {
      var node = parse('2.76 / 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive int/int -> int", function() {
      var node = parse('1 / 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
    it("should annotate primitive float%float -> float", function() {
      var node = parse('2.76 % 1.5');
      annotator.annotate(node);
      expect(node.exprType).to.equal('float');
    });
    it("should annotate primitive int%int -> int", function() {
      var node = parse('1 % 2');
      annotator.annotate(node);
      expect(node.exprType).to.equal('int');
    });
  });
});

