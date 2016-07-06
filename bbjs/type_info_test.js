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
      expect(typeInfo.classExists('local.one.A')).to.be(true);
    });
    it("should return false for non-existent classes", function() {
      expect(typeInfo.classExists('local.one.DoesNotExist')).to.be(false);
    });
    it("should return true for primitive types", function() {
      expect(typeInfo.classExists('int')).to.be(true);
    });
  });

  describe("#isSubclass", function() {
    it("should return true for explicitly extended class", function() {
      expect(typeInfo.isSubclass('local.one.B', 'local.one.A')).to.be(true);
    });
    it("should respect implicit Object inheritance", function() {
      expect(typeInfo.isSubclass(
          'local.one.A', 'bb.lang.Object')).to.be(true);
    });
    it("should return true for class implementing interface", function() {
      expect(typeInfo.isSubclass('local.one.A', 'local.one.Ia')).to.be(true);
    });
    it("should return true for indirect inheritance", function() {
      expect(typeInfo.isSubclass('local.one.C', 'local.one.A')).to.be(true);
    });
    it("should return true for class indirectly implementing interface",
       function() {
      expect(typeInfo.isSubclass('local.one.B', 'local.one.Ia')).to.be(true);
    });
    it("should return false for class that doesn't inherit", function() {
      expect(typeInfo.isSubclass('local.one.D', 'local.one.A')).to.be(false);
    });
    it("primitives do not inherit from Object", function() {
      expect(typeInfo.isSubclass('int', 'bb.lang.Object')).to.be(false);
    });
    it("primitives are still subclasses of themselves", function() {
      expect(typeInfo.isSubclass('int', 'int')).to.be(true);
    });
    it("primitives are not subclasses of each other", function() {
      expect(typeInfo.isSubclass('int', 'false')).to.be(false);
    });
    it("should recognize inheritance across modules", function() {
      expect(typeInfno.isSubclass('local.two.D', 'local.one.A')).to.be(true);
    });
  });

  describe("#getAttributeType", function() {
    it("should recognize direct attribute", function(){
      expect(typeInfo.getAttributeType('local.one.A', 'x')).to.be('int');
    });
    it("should recognize inherited attribute", function() {
      expect(typeInfo.getAttributeType('local.one.B', 'x')).to.be('int');
    });
    it("should throw when it doesn't recognize attribute", function() {
      expect(typeInfo.getAttributeType('local.one.A', 'y')).to.throw(Error);
    });
  });

  describe("#getStaticAttributeType", function() {
    it("should recognize direct attribute", function(){
      expect(typeInfo.getStaticAttributeType('local.one.A', 'a')).to.be(
          'bb.lang.String');
    });
    it("should not inherited attribute", function() {
      expect(typeInfo.getStaticAttributeType('local.one.B', 'x')).to.throw(
          Error);
    });
  });

  describe('#getMethodType', function() {
    it("should recognize direct method", function() {
      expect(typeInfo.getMethodType('local.one.A', 'f')).to.be('int');
    });
    it("should recognize inherited method", function() {
      expect(typeInfo.getMethodType('local.one.B', 'f')).to.be('int');
    });
    it("should throw when it doesn't recognize method", function() {
      expect(typeInfo.getMethodType('local.one.A', 'g')).to.throw(Error);
    });
  });

  describe("#getStaticMethodType", function() {
    it("should recognize direct method", function(){
      expect(typeInfo.getStaticMethodType('local.one.A', 'foo')).to.be(
          'bb.lang.String');
    });
    it("should not inherit method", function() {
      expect(typeInfo.getStaticMethodType('local.one.B', 'foo')).to.throw(
          Error);
    });
  });

  describe('#getMethodArgTypes', function() {
    it("should return list of qualified argument typenames", function() {
      expect(typeInfo.getMethodArgTypes('local.one.A', 'f')).to.deep.equal(
        ['bb.lang.List']
      );
    });
    it("should throw when it doesn't recognize method", function() {
      expect(typeInfo.getMethodArgTypes('local.one.A', 'g')).to.throw(Error);
    });
  });

  describe('#getStaticMethodArgTypes', function() {
    it("should return list of qualified argument typenames", function() {
      expect(typeInfo.getStaticMethodArgTypes('local.one.A', 'foo'))
        .to.deep.equal(['int', 'float']);
    });
    it("should throw when it doesn't recognize method", function() {
      expect(typeInfo.getStaticMethodArgTypes('local.one.A', 'g')).to.throw(
          Error);
    });
  });

});
