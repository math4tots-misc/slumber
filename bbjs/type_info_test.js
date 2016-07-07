/* jshint esversion: 6 */

var chai = require('chai');
var expect = chai.expect;
var chaiSubset = require('chai-subset');
var parser = require('./grammar.js');
var TypeInfo = require('./type_info.js').TypeInfo;
chai.use(chaiSubset);

describe("TypeInfo", function() {

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

  var module2 = `
  package local.two;
  import local.one.A;
  class D extends A {}
  `;

  var typeInfo = new TypeInfo();

  typeInfo.processAllModules([
    parser.parse(module0),
    parser.parse(module1),
    parser.parse(module2),
  ]);

  describe("#classExists", function() {
    it("should return true when class has been declared", function() {
      expect(typeInfo.classExists('local.one.A')).to.equal(true);
    });
    it("should return false for non-existent classes", function() {
      expect(typeInfo.classExists('local.one.DoesNotExist')).to.equal(
          false);
    });
    it("should return true for primitive types", function() {
      expect(typeInfo.classExists('int')).to.equal(true);
    });
  });

  describe("#isSubclass", function() {
    it("should return true for explicitly extended class", function() {
      expect(typeInfo.isSubclass('local.one.B', 'local.one.A')).to.equal(
          true);
    });
    it("should respect implicit Object inheritance", function() {
      expect(typeInfo.isSubclass(
          'local.one.A', 'bb.lang.Object')).to.equal(true);
    });
    it("should return true for class implementing interface", function() {
      expect(typeInfo.isSubclass('local.one.A', 'local.one.Ia')).to.equal(
          true);
    });
    it("should return true for indirect inheritance", function() {
      expect(typeInfo.isSubclass('local.one.C', 'local.one.A')).to.equal(
          true);
    });
    it("should return true for class indirectly implementing interface",
       function() {
      expect(typeInfo.isSubclass('local.one.B', 'local.one.Ia')).to.equal(
          true);
    });
    it("should return false for class that doesn't inherit", function() {
      expect(typeInfo.isSubclass('local.one.D', 'local.one.A')).to.equal(
          false);
    });
    it("primitives do not inherit from Object", function() {
      expect(typeInfo.isSubclass('int', 'bb.lang.Object')).to.equal(false);
    });
    it("primitives are still subclasses of themselves", function() {
      expect(typeInfo.isSubclass('int', 'int')).to.equal(true);
    });
    it("primitives are not subclasses of each other", function() {
      expect(typeInfo.isSubclass('int', 'false')).to.equal(false);
    });
    it("should recognize inheritance across modules", function() {
      expect(typeInfo.isSubclass('local.two.D', 'local.one.A')).to.equal(
          true);
    });
  });

  describe("#getAttributeType", function() {
    it("should recognize direct attribute", function(){
      expect(typeInfo.getAttributeType('local.one.A', 'x')).to.equal('int');
    });
    it("should recognize inherited attribute", function() {
      expect(typeInfo.getAttributeType('local.one.B', 'x')).to.equal('int');
    });
    it("should throw when it doesn't recognize attribute", function() {
      expect(function() {
        typeInfo.getAttributeType('local.one.A', 'y');
      }).to.throw(Error);
    });
    it("should throw if it is a static attribute", function() {
      expect(function() {
        typeInfo.getAttributeType('local.one.A', 'a');
      }).to.throw(Error);
    });
  });

  describe("#getStaticAttributeType", function() {
    it("should recognize direct attribute", function(){
      expect(typeInfo.getStaticAttributeType('local.one.A', 'a')).to.equal(
          'bb.lang.String');
    });
    it("should not inherit static attribute", function() {
      expect(function() {
        typeInfo.getStaticAttributeType('local.one.B', 'a');
      }).to.throw(Error);
    });
    it("should throw on member attribute", function() {
      expect(function() {
        typeInfo.getStaticAttributeType('local.one.A', 'x');
      }).to.throw(Error);
    });
  });

  describe('#getMethodType', function() {
    it("should recognize direct method", function() {
      expect(typeInfo.getMethodType('local.one.A', 'f')).to.equal('int');
    });
    it("should recognize inherited method", function() {
      expect(typeInfo.getMethodType('local.one.B', 'f')).to.equal('int');
    });
    it("should throw when it doesn't recognize method", function() {
      expect(function() {
        typeInfo.getMethodType('local.one.A', 'g');
      }).to.throw(Error);
    });
  });

  describe("#getStaticMethodType", function() {
    it("should recognize direct method", function(){
      expect(typeInfo.getStaticMethodType('local.one.A', 'foo')).to.equal(
          'bb.lang.String');
    });
    it("should not inherit method", function() {
      expect(function() {
        typeInfo.getStaticMethodType('local.one.B', 'foo');
      }).to.throw(Error);
    });
  });

  describe('#getMethodArgTypes', function() {
    it("should return list of qualified argument typenames", function() {
      expect(typeInfo.getMethodArgTypes('local.one.A', 'f')).to.deep.equal(
        ['bb.lang.List']
      );
    });
    it("should throw when it doesn't recognize method", function() {
      expect(function() {
        typeInfo.getMethodArgTypes('local.one.A', 'g');
      }).to.throw(Error);
    });
  });

  describe('#getStaticMethodArgTypes', function() {
    it("should return list of qualified argument typenames", function() {
      expect(typeInfo.getStaticMethodArgTypes('local.one.A', 'foo'))
        .to.deep.equal(['int', 'float']);
    });
    it("should throw when it doesn't recognize method", function() {
      expect(function() {
        typeInfo.getStaticMethodArgTypes('local.one.A', 'g');
      }).to.throw(Error);
    });
  });

  describe("#processAllModules", function() {
    it("should throw on duplicate attribute definition", function() {
      var typeInfo = new TypeInfo();
      var module3 = `
      package local.three;
      class A {
        int a;
        float a;
      }
      `;
      expect(function() {
        typeInfo.processAllModules([
          parser.parse(module0),
          parser.parse(module3),
        ]);
      }).to.throw(Error);
    });
    it("should throw on duplicate method definition", function() {
      var typeInfo = new TypeInfo();
      var module3 = `
      package local.three;
      class A {
        int a;
        float a;
      }
      `;
      expect(function() {
        typeInfo.processAllModules([
          parser.parse(module0),
          parser.parse(module3),
        ]);
      }).to.throw(Error);
    });
    it("should throw on inheritance attribute clash", function() {
      var typeInfo = new TypeInfo();
      var module3 = `
      package local.three;
      class A {
        int a;
      }
      class B extends A {
        int a;
      }
      `;
      expect(function() {
        typeInfo.processAllModules([
          parser.parse(module0),
          parser.parse(module3),
        ]);
      }).to.throw(Error);
    });
  });
});
