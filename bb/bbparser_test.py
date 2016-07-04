import unittest
import bbparser
import bbast


class TestCase(unittest.TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.maxDiff = None


class EmptyTestCase(TestCase):
    def test(self):
        source = bbparser.Source('<test>', '')
        with self.assertRaises(bbparser.CompileError):
            bbparser.parse(source)


class OnlyPackageTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', 'package local;'))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')


class ModuleDocTestCase(TestCase):
    def test(self):
        parser = bbparser.Parser(bbparser.Source('<test>', r"""
        'some module docs'
        package local.sample;

        import java.util.HashMap;
        import java.util.ArrayList as List;

        """))
        ast = parser.parse_module()
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.doc, "some module docs")


class ImportTestCase(TestCase):
    def test(self):
        parser = bbparser.Parser(bbparser.Source('<test>', r"""
        package local.sample;

        import java.util.HashMap;
        import java.util.ArrayList as List;

        """))
        ast = parser.parse_module()
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local.sample')
        self.assertEqual(
            ast.imports, ['java.util.HashMap', 'java.util.ArrayList'])
        self.assertEqual(
            parser.alias_table,
            {
                'List': 'java.util.ArrayList',
                'HashMap': 'java.util.HashMap',
            })


class EmptyClassTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class Klass {
            "some docs for Klass"
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        self.assertEqual(ast.imports, [])
        classes = ast.classes
        self.assertEqual(len(classes), 1, classes)
        cls = classes[0]
        self.assertEqual(cls.name, 'Klass')
        self.assertEqual(cls.doc, 'some docs for Klass')


class ClassMetaDataTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        import java.util.Interface2;
        import java.util.Interface3 as If3;

        class Klass extends BaseKlass implements Interface1, Interface2, If3 {
            "some docs for Klass"
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        self.assertEqual(ast.imports, [
            'java.util.Interface2',
            'java.util.Interface3',
        ])
        classes = ast.classes
        self.assertEqual(len(classes), 1, classes)
        cls = classes[0]
        self.assertEqual(cls.name, 'Klass')
        self.assertEqual(cls.doc, 'some docs for Klass')
        self.assertEqual(cls.base, 'local.BaseKlass')
        self.assertEqual(cls.interfaces, [
            'local.Interface1',
            'java.util.Interface2',
            'java.util.Interface3',
        ])


class ClassWithOneMemberTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class SomeKlass {
            "docs for SomeKlass"

            int count;
                "Some doc for the count attribute"
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'SomeKlass')
        self.assertEqual(cls.doc, 'docs for SomeKlass')
        members = cls.members
        self.assertEqual(len(members), 1, members)
        member = members[0]
        self.assertEqual(member.type, 'int')
        self.assertEqual(member.name, 'count')
        self.assertEqual(member.doc, 'Some doc for the count attribute')


class MemberInInterfaceTestCase(TestCase):
    def test(self):
        TEMPLATE = r"""
        package local;

        interface SomeInterface {
        %s
        }

        """
        # Interfaces are not allowed to have members in them.
        source = bbparser.Source('<test>', TEMPLATE % "  int count;")
        with self.assertRaises(bbparser.CompileError):
            bbparser.parse(source)

        # Control group
        source = bbparser.Source('<test>', TEMPLATE % "")
        ast = bbparser.parse(source)
        self.assertEqual(len(ast.classes), 1, ast.classes)
        interface = ast.classes[0]
        self.assertEqual(interface.name, 'SomeInterface')
        self.assertTrue(interface.is_interface)


class InterfaceWithOneMethodTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        interface SomeKlass {
            String foo(int a, SomeKlass b);
                '''Some docs for abstract method foo'''
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'SomeKlass')
        methods = cls.methods
        self.assertEqual(len(methods), 1, methods)
        method = methods[0]
        self.assertEqual(method.returns, 'bb.lang.String')
        self.assertEqual(method.name, 'foo')
        self.assertEqual(method.args, [
            ('int', 'a'),
            ('local.SomeKlass', 'b'),
        ]);
        self.assertEqual(method.doc, "Some docs for abstract method foo")


class ExpressionTestCase(TestCase):
    def test_name(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'varname'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Name)
        self.assertEqual(ast.name, 'varname')

    def test_null(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'null'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Null)

    def test_true(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'true'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.TrueExpression)

    def test_false(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'false'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.FalseExpression)

    def test_this(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'this'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.This)

    def test_int(self):
        parser = bbparser.Parser(bbparser.Source('<test>', '5'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Int)
        self.assertEqual(ast.value, '5')

    def test_float(self):
        parser = bbparser.Parser(bbparser.Source('<test>', '5.1'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Float)
        self.assertEqual(ast.value, '5.1')

    def test_string(self):
        parser = bbparser.Parser(bbparser.Source('<test>', '"hi"'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.String)
        self.assertEqual(ast.value, 'hi')

    def test_assign(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'x = "hi"'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Assign)
        self.assertEqual(ast.name, 'x')
        expr = ast.expr
        self.assertEqual(type(expr), bbast.String)
        self.assertEqual(expr.value, 'hi')

    def test_get_static(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'Test.test'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.GetStaticAttribute)
        self.assertEqual(ast.type, '.Test')
        self.assertEqual(ast.attribute_name, 'test')

    def test_set_static(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'Test.test = 5'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.SetStaticAttribute)
        self.assertEqual(ast.type, '.Test')
        self.assertEqual(ast.attribute_name, 'test')
        self.assertEqual(type(ast.expr), bbast.Int)
        self.assertEqual(ast.expr.value, '5')

    def test_call_static(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'Test.test()'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.StaticMethodCall)
        self.assertEqual(ast.type, '.Test')
        self.assertEqual(ast.method_name, 'test')
        self.assertEqual(ast.args, [])

    def test_call_method(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'test.method()'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.MethodCall)
        self.assertEqual(type(ast.owner), bbast.Name)
        self.assertEqual(ast.owner.name, 'test')
        self.assertEqual(ast.method_name, 'method')
        self.assertEqual(ast.args, [])

    def test_getattr(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'test.method'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.GetAttribute)
        self.assertEqual(type(ast.owner), bbast.Name)
        self.assertEqual(ast.owner.name, 'test')
        self.assertEqual(ast.attribute_name, 'method')

    def test_setattr(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'test.method = 2'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.SetAttribute)
        self.assertEqual(type(ast.owner), bbast.Name)
        self.assertEqual(ast.owner.name, 'test')
        self.assertEqual(ast.attribute_name, 'method')
        self.assertEqual(type(ast.expr), bbast.Int)
        self.assertEqual(ast.expr.value, '2')

    def test_assign(self):
        parser = bbparser.Parser(bbparser.Source('<test>', 'test = 2'))
        ast = parser.parse_expression()
        self.assertEqual(type(ast), bbast.Assign)
        self.assertEqual(ast.name, 'test')
        self.assertEqual(type(ast.expr), bbast.Int)
        self.assertEqual(ast.expr.value, '2')


class ClassWithOneMethodTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class SomeKlass {

            int count;
                "Some member comments for count"

            String foo() {
                "Some method comments for foo";

                System.out.println('hi');
            }

            void bar() {
                "Some method comments for bar";
            }
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'SomeKlass')
        members = cls.members
        self.assertEqual(len(members), 1, members)
        member = members[0]
        self.assertEqual(member.type, 'int')
        self.assertEqual(member.name, 'count')
        self.assertEqual(member.doc, "Some member comments for count")

        methods = cls.methods
        self.assertEqual(len(methods), 2, methods)
        self.assertEqual(methods[0].name, 'foo')
        self.assertEqual(methods[0].returns, 'bb.lang.String')
        self.assertEqual(methods[0].args, [])
        self.assertEqual(methods[0].doc, "Some method comments for foo")
        self.assertEqual(methods[1].name, 'bar')
        self.assertEqual(methods[1].returns, 'void')
        self.assertEqual(methods[1].args, [])
        self.assertEqual(methods[1].doc, "Some method comments for bar")


class NativeClassTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        native class NativeKlass {
            "This is a native class"

            static int staticNativeMethod();
                '''
                This is a static native method.
                Only native classes can declare a static method without
                defining it.
                '''

            String nativeMethod();
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'NativeKlass')
        self.assertTrue(cls.is_native)
        self.assertFalse(cls.is_interface)
        self.assertEqual(cls.doc, "This is a native class")

        members = cls.members
        self.assertEqual(len(members), 0, members)

        methods = cls.methods
        self.assertEqual(len(methods), 2, methods)
        self.assertEqual(methods[0].name, 'staticNativeMethod')
        self.assertEqual(methods[0].returns, 'int')
        self.assertEqual(methods[0].args, [])
        self.assertEqual(methods[1].name, 'nativeMethod')
        self.assertEqual(methods[1].returns, 'bb.lang.String')
        self.assertEqual(methods[1].args, [])


class ClassWithOneMethodTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class SomeKlass {

            int count;
                "Some member comments for count"

            String foo() {
                "Some method comments for foo";

                System.out.println('hi');
            }

            void bar() {
                "Some method comments for bar";
            }
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'SomeKlass')
        members = cls.members
        self.assertEqual(len(members), 1, members)
        member = members[0]
        self.assertEqual(member.type, 'int')
        self.assertEqual(member.name, 'count')
        self.assertEqual(member.doc, "Some member comments for count")

        methods = cls.methods
        self.assertEqual(len(methods), 2, methods)
        self.assertEqual(methods[0].name, 'foo')
        self.assertEqual(methods[0].returns, 'bb.lang.String')
        self.assertEqual(methods[0].args, [])
        self.assertEqual(methods[0].doc, "Some method comments for foo")
        self.assertEqual(methods[1].name, 'bar')
        self.assertEqual(methods[1].returns, 'void')
        self.assertEqual(methods[1].args, [])
        self.assertEqual(methods[1].doc, "Some method comments for bar")


class EmptyDocInMethodTestCase(TestCase):
    def test(self):
        ast = bbparser.parse(bbparser.Source('<test>', r"""
        package local;

        class Klass {
            void f() {}
        }

        """))
        self.assertEqual(type(ast), bbast.Module)
        self.assertEqual(ast.package, 'local')
        cls = ast.classes[0]
        self.assertEqual(cls.name, 'Klass')
        self.assertFalse(cls.is_native)
        self.assertFalse(cls.is_interface)
        self.assertEqual(cls.doc, None)
        self.assertEqual(cls.methods[0].doc, None)


if __name__ == '__main__':
    unittest.main()
