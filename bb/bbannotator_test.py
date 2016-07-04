import unittest
import bbannotator
import bbparser
import bbast


class TestCase(unittest.TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.maxDiff = None


class ExtractTypeDataTestCase(TestCase):

    def test0(self):
        source = bbparser.Source('<test>', r"""
        package local;
        class A {
            int x;
            void f() {}
        }
        """)
        ast = bbparser.parse(source)
        data = bbannotator.extract_type_data(ast.classes)
        self.assertEqual(data, {
            'local.A': {
                'x': 'int',
                'f': ('void', ()),
            },
            'bb.lang.Object': {},
        })

    def test1(self):
        source = bbparser.Source('<test>', r"""
        package local;
        class A {
            int x;
            void f() {}
            void h() {}
        }
        class B extends A {
            float y;
            String g(int y) {}

            String h(int y) {
                '''This is bad: notice how we override A.h, but
                have mismatched types.
                There's no operator overloading, so this is not desired
                behiavior. In the future raise an error.
                ''';
            }
        }
        """)
        ast = bbparser.parse(source)
        data = bbannotator.extract_type_data(ast.classes)
        self.assertEqual(data, {
            'local.A': {
                'x': 'int',
                'f': ('void', ()),
                'h': ('void', ()),
            },
            'local.B': {
                'x': 'int',
                'f': ('void', ()),
                'y': 'float',
                'g': ('bb.lang.String', ('int',)),
                'h': ('bb.lang.String', ('int',)),
            },
            'bb.lang.Object': {},
        })

    def test2(self):
        """Despite my hurried implementation, I still have some
        very very minimal checks."""
        source = bbparser.Source('<test>', r"""
        package local;
        class A {
            int x;
        }
        class B extends A {
            void x() {}
        }
        """)
        ast = bbparser.parse(source)
        with self.assertRaises(bbparser.CompileError):
            data = bbannotator.extract_type_data(ast.classes)

        source = bbparser.Source('<test>', r"""
        package local;
        class A {
            int x;
        }
        class B extends A {
            int x;
        }
        """)
        ast = bbparser.parse(source)
        with self.assertRaises(bbparser.CompileError):
            data = bbannotator.extract_type_data(ast.classes)


class AnnotatorTestCase(TestCase):
    def test_expr0(self):
        module_0 = bbparser.parse(bbparser.Source('<test>', r"""
        package bb.lang;

        native class String {
            int size();
        }

        """))
        module_1 = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class Foo {
            String bar;
        }

        """))
        type_data = bbannotator.extract_type_data(
            module_0.classes +
            module_1.classes)

        parser = bbparser.Parser(bbparser.Source(
            '<test>', '5'))
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.Int)
        self.assertEqual(expr.deduced_type, 'int')

        parser = bbparser.Parser(bbparser.Source(
            '<test>', '5.5'))
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.Float)
        self.assertEqual(expr.deduced_type, 'float')

        parser = bbparser.Parser(bbparser.Source(
            '<test>', '"hi"'))
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.String)
        self.assertEqual(expr.deduced_type, 'bb.lang.String')

        parser = bbparser.Parser(bbparser.Source(
            '<test>', '"hi".size()'))
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.MethodCall)
        self.assertEqual(expr.deduced_type, 'int')

        parser = bbparser.Parser(bbparser.Source(
            '<test>', 'Foo().bar'))
        parser.package = 'local'
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.GetAttribute)
        self.assertEqual(expr.deduced_type, 'bb.lang.String')

        parser = bbparser.Parser(bbparser.Source(
            '<test>', 'Foo().bar.size()'))
        parser.package = 'local'
        expr = parser.parse_expression()
        bbannotator.Annotator(type_data).visit(expr)
        self.assertEqual(type(expr), bbast.MethodCall)
        self.assertEqual(expr.deduced_type, 'int')



if __name__ == '__main__':
    unittest.main()

