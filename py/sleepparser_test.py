import unittest
import sleepparser as sleep


class TestCase(unittest.TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.maxDiff = None


EMPTY_LEXER_EXAMPLE = sleep.Source('<EMPTY_LEXER_EXAMPLE>', '')

SIMPLE_LEXER_EXAMPLE = sleep.Source('<SIMPLE_LEXER_EXAMPLE>', r"""
# Some comments
class TypeName Type methodName 12 1.3 x.y () 'hoi'
""")


class LexerTestCase(TestCase):

    def test_empty_lexer_example(self):
        tokens = sleep.lex(EMPTY_LEXER_EXAMPLE)
        type_value_pairs = [(token.type, token.value) for token in tokens]
        self.assertEqual(type_value_pairs, [('EOF', None)])

    def test_simple_example(self):
        tokens = sleep.lex(SIMPLE_LEXER_EXAMPLE)
        type_value_pairs = [(token.type, token.value) for token in tokens]

        self.assertEqual(type_value_pairs, [
            ('class', None),
            ('TYPENAME', 'TypeName'),
            ('TYPENAME', 'Type'),
            ('NAME', 'methodName'),
            ('INT', '12'),
            ('FLOAT', '1.3'),
            ('NAME', 'x'),
            ('.', None),
            ('NAME', 'y'),
            ('(', None),
            (')', None),
            ('STRING', 'hoi'),
            ('EOF', None),
        ])


EMPTY_PARSER_EXAMPLE = sleep.Source('<EMPTY_PARSER_EXAMPLE>', '')

SIMPLE_PARSER_INTERFACE_EXAMPLE = sleep.Source(
    '<SIMPLE_PARSER_INTERFACE_EXAMPLE>', r"""
interface ExampleInterface {
    int exampleMethod(String name, float arg1)
    float secondMethod()
}
""")

SIMPLE_PARSER_CLASS_EXAMPLE = sleep.Source(
    '<SIMPLE_PARSER_CLASS_EXAMPLE>', r"""
class ExampleClass {
    String toString() {
        return '<example>';
    }
}
""")

SIMPLE_PARSER_EXPRESSION_EXAMPLE = sleep.Source(
    '<SIMPLE_PARSER_EXPRESSION_EXAMPLE>',
    "5 + 7 > 10 ? 'yes' : 'no'")

PARSER_IMPORT_EXAMPLE = sleep.Source(
    '<PARSER_IMPORT_EXAMPLE>', r"""
package org.sample

import com.foo.Bar
import com.bar.Baz as Bazy

""")

class ParserTestCase(TestCase):

    def test_empty_parser_example(self):
        ast = sleep.parse(EMPTY_PARSER_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)
        self.assertEqual(ast.package, [])

    def test_simple_interface_example(self):
        ast = sleep.parse(SIMPLE_PARSER_INTERFACE_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)
        self.assertEqual(ast.package, [])

        interfaces = ast.interfaces
        interface_names = [interface.name for interface in interfaces]
        self.assertEqual(interface_names, ['ExampleInterface'])

        stubs = list(interfaces[0].stubs)
        stub_names = [stub.name for stub in stubs]
        self.assertEqual(stub_names, ['exampleMethod', 'secondMethod'])

        self.assertEqual(len(stubs), 2)

        # inspect exampleMethod
        stub = stubs[0]
        self.assertEqual(stub.name, 'exampleMethod')
        self.assertEqual(stub.returns.name, 'int')
        arglist = stub.arglist
        self.assertEqual(len(arglist), 2)
        self.assertEqual(type(arglist[0][0]), sleep.Typename)
        self.assertEqual(arglist[0][0].name, 'String')
        self.assertEqual(arglist[0][1], 'name')
        self.assertEqual(arglist[1][0].name, 'float')
        self.assertEqual(arglist[1][1], 'arg1')

        # inspect secondMethod
        stub = stubs[1]
        self.assertEqual(stub.name, 'secondMethod')
        self.assertEqual(stub.returns.name, 'float')
        arglist = stub.arglist
        self.assertEqual(len(arglist), 0)

    def test_simple_class_example(self):
        ast = sleep.parse(SIMPLE_PARSER_CLASS_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)
        self.assertEqual(ast.package, [])
        classes = ast.classes
        class_names = [cls.name for cls in classes]
        self.assertEqual(class_names, ['ExampleClass'])

        methods = list(classes[0].methods)
        self.assertEqual(len(methods), 1)

        # inspect toString
        method = methods[0]
        self.assertEqual(method.name, 'toString')
        self.assertEqual(method.returns.name, 'String')
        self.assertEqual(len(method.arglist), 0)

    def test_simple_expression_example(self):
        parser = sleep.Parser(SIMPLE_PARSER_EXPRESSION_EXAMPLE)
        ast = parser.parse_expression()
        self.assertEqual(type(ast), sleep.TernaryExpression)

    def test_import_example(self):
        ast = sleep.parse(PARSER_IMPORT_EXAMPLE)
        self.assertEqual(ast.package, ['org', 'sample'])
        imports = ast.imports
        ids = [(i.package, i.name, i.alias) for i in imports]
        self.assertEqual(
            ids,
            [
                (['com', 'foo'], 'Bar', 'Bar'),
                (['com', 'bar'], 'Baz', 'Bazy'),
            ])


class TestLoader(object):
    def __init__(self, table):
        self.table = table

    def load(self, uri):
        return self.table[uri]




if __name__ == '__main__':
    unittest.main()
