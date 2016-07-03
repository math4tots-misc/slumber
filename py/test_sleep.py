import unittest
import sleep


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

class ParserTestCase(TestCase):

    def test_empty_parser_example(self):
        ast = sleep.parse(EMPTY_PARSER_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)

    def test_simple_interface_example(self):
        ast = sleep.parse(SIMPLE_PARSER_INTERFACE_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)

        interfaces = ast.interfaces
        interface_names = [interface.name for interface in interfaces]
        self.assertEqual(interface_names, ['ExampleInterface'])

        stubs = list(interfaces[0].stubs)
        stub_names = [stub.name for stub in stubs]
        self.assertEqual(stub_names, ['exampleMethod', 'secondMethod'])

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

    def test_simple_class_example(self):
        ast = sleep.parse(SIMPLE_PARSER_CLASS_EXAMPLE)
        self.assertEqual(type(ast), sleep.FileInput)
        classes = ast.classes
        class_names = [cls.name for cls in classes]
        self.assertEqual(class_names, ['ExampleClass'])

if __name__ == '__main__':
    unittest.main()
