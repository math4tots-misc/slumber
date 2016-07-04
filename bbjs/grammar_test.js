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
    it("should parse ' quoted strings", function() {
      expect(parse("'hoixx f'")).to.containSubset({
          type: "String",
          val: 'hoixx f',
      });
    });
    it("should parse Name", function() {
      expect(parse("hiThere")).to.containSubset({
          type: "Name",
          val: 'hiThere',
      });
    });
    it("should parse Name wrapped in parenthesis", function() {
      expect(parse("(hiThere)")).to.containSubset({
          type: "Name",
          val: 'hiThere',
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
  });
});
