import unittest
import sleeplexer as lexer


class TestCase(unittest.TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.maxDiff = None


EMPTY_LEXER_EXAMPLE = lexer.Source('<EMPTY_LEXER_EXAMPLE>', '')

SIMPLE_LEXER_EXAMPLE = lexer.Source('<SIMPLE_LEXER_EXAMPLE>', r"""
# Some comments
class TypeName Type methodName 12 1.3 x.y () 'hoi'
""")


class LexerTestCase(TestCase):

    def test_empty_lexer_example(self):
        tokens = lexer.lex(EMPTY_LEXER_EXAMPLE)
        type_value_pairs = [(token.type, token.value) for token in tokens]
        self.assertEqual(type_value_pairs, [('EOF', None)])

    def test_simple_example(self):
        tokens = lexer.lex(SIMPLE_LEXER_EXAMPLE)
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

    def test_string_ends_with_int(self):
        # This used to crash because I didn't do an EOF check.
        tokens = lexer.lex(lexer.Source('<test>', ' 2342'))
        self.assertEqual(len(tokens), 2)
        self.assertEqual(tokens[0].type, 'INT')
        self.assertEqual(tokens[0].value, '2342')
        self.assertEqual(tokens[1].type, 'EOF')

    def test_string_ends_with_float(self):
        # The 'int' version of this made me paranoid.
        tokens = lexer.lex(lexer.Source('<test>', ' 2342.5'))
        self.assertEqual(len(tokens), 2)
        self.assertEqual(tokens[0].type, 'FLOAT')
        self.assertEqual(tokens[0].value, '2342.5')
        self.assertEqual(tokens[1].type, 'EOF')


if __name__ == '__main__':
    unittest.main()

