import unittest
import sleepparser as parser
import sleepast as ast


class TestCase(unittest.TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.maxDiff = None


EMPTY_PARSER_EXAMPLE = parser.Source('<EMPTY_PARSER_EXAMPLE>', '')

SIMPLE_PARSER_INTERFACE_EXAMPLE = parser.Source(
    '<SIMPLE_PARSER_INTERFACE_EXAMPLE>', r"""
interface ExampleInterface {
    int exampleMethod(String name, float arg1)
    float secondMethod()
}
""")

SIMPLE_PARSER_CLASS_EXAMPLE = parser.Source(
    '<SIMPLE_PARSER_CLASS_EXAMPLE>', r"""
class ExampleClass {
    String toString() {
        return '<example>';
    }
}
""")

SIMPLE_PARSER_EXPRESSION_EXAMPLE = parser.Source(
    '<SIMPLE_PARSER_EXPRESSION_EXAMPLE>',
    "5 + 7 > 10 ? 'yes' : 'no'")

PARSER_IMPORT_EXAMPLE = parser.Source(
    '<PARSER_IMPORT_EXAMPLE>', r"""
package org.sample

import com.foo.Bar
import com.bar.Baz as Bazy

""")

class ParserTestCase(TestCase):

    def test_empty_parser_example(self):
        node = parser.parse(EMPTY_PARSER_EXAMPLE)
        self.assertEqual(type(node), ast.FileInput)
        self.assertEqual(node.package, [])

    def test_simple_interface_example(self):
        node = parser.parse(SIMPLE_PARSER_INTERFACE_EXAMPLE)
        self.assertEqual(type(node), ast.FileInput)
        self.assertEqual(node.package, [])

        interfaces = node.interfaces
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
        self.assertEqual(type(arglist[0][0]), ast.Typename)
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
        node = parser.parse(SIMPLE_PARSER_CLASS_EXAMPLE)
        self.assertEqual(type(node), ast.FileInput)
        self.assertEqual(node.package, [])
        classes = node.classes
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
        p = parser.Parser(SIMPLE_PARSER_EXPRESSION_EXAMPLE)
        node = p.parse_expression()
        self.assertEqual(type(node), ast.TernaryExpression)

    def test_import_example(self):
        node = parser.parse(PARSER_IMPORT_EXAMPLE)
        self.assertEqual(node.package, ['org', 'sample'])
        imports = node.imports
        ids = [(i.package, i.name, i.alias) for i in imports]
        self.assertEqual(
            ids,
            [
                (['com', 'foo'], 'Bar', 'Bar'),
                (['com', 'bar'], 'Baz', 'Bazy'),
            ])

    def test_static_method_call(self):
        p = parser.Parser(parser.Source('<test>', 'Klass.method(x, 5)'))
        node = p.parse_expression()
        self.assertEqual(type(node), ast.StaticMethodCallExpression)
        self.assertEqual(node.method_name, 'method')

    def test_mod_operator(self):
        p = parser.Parser(parser.Source('<test>', 'x % 5'))
        node = p.parse_expression()
        self.assertEqual(type(node), ast.MethodCallExpression)
        self.assertEqual(node.method_name, '__mod__')


if __name__ == '__main__':
    unittest.main()
