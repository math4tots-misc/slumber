OPEN = '('
CLOSE = ')'

class Source(object):
    def __init__(self, uri, text):
        self.uri = uri
        self.text = text

class Token(object):
    def __init__(self, source, pos, type_, value=None):
        self.source = source
        self.pos = pos
        self.type = type_
        self.value = value

    def __repr__(self):
        return 'Token(type_=%r, value=%r)' % (self.type, self.value)

class ParseError(Exception):
    def __init__(self, token, message):
        super(ParseError, self).__init__(message)
        self.token = token
        self.message = message

KEYWORDS = {
    'interface', 'class', 'public', 'private', 'static',
    'extends', 'implements',
    'from', 'import', 'as',
    'while', 'break', 'continue', 'if', 'else',
    'return',
}

PRIMITIVE_TYPES = {
    'void', 'int', 'float', 'bool',
}

SYMBOLS = tuple(reversed(sorted({
    '(', ')', '[', ']', '{', '}',
    '=', '+=', '-=', '%=', '*=', '/=',
    '+', '-', '*', '/', '%',
    '<', '>', '<=', '>=', '==', '!=',
    ';', '.', ',',
})))

ESCAPE_TABLE = {
    'n': '\n',
    't': '\t',
    '\\': '\\',
    '"': '"',
    "'": "'",
}

class Lexer(object):
    def __init__(self, source):
        self.source = source
        self.text = source.text
        self.pos = 0
        self.peek = self._extract_token()
        self.done = False

    def next(self):
        token = self.peek
        self.peek = self._extract_token()
        self.done = token.type == 'EOF'
        return token

    def _skip_whitespace_and_comments(self):
        while (self.pos < len(self.text) and
               (self.text[self.pos] == '#' or
                self.text[self.pos].isspace())):
            if self.text[self.pos] == '#':
                while (self.pos < len(self.text) and
                       self.text[self.pos] != '\n'):
                    self.pos += 1
            else:
                self.pos += 1

    def _extract_token(self):
        self._skip_whitespace_and_comments()
        if self.pos >= len(self.text):
            return Token(self.source, self.pos, 'EOF')

        start = self.pos

        # INT or FLOAT
        if self.text[self.pos].isdigit():
            while self.text[self.pos].isdigit():
                self.pos += 1
            if self.text[self.pos] == '.':
                self.pos += 1
                while self.text[self.pos].isdigit():
                    self.pos += 1
                value = self.text[start:self.pos]
                return Token(self.source, start, 'FLOAT', value)
            else:
                value = self.text[start:self.pos]
                return Token(self.source, start, 'INT', value)

        # STRING
        if self.text.startswith(('r"', "r'", '"', "'"), self.pos):
            if self.text[self.pos] == 'r':
                raw = True
                self.pos += 1
            else:
                raw = False

            if self.text.startswith(('"""', "'''"), self.pos):
                quote = self.text[self.pos:self.pos+3]
                self.pos += 3
            else:
                quote = self.text[self.pos]
                self.pos += 1

            chars = []

            while not self.text.startswith(quote, self.pos):
                if self.pos >= len(self.text):
                    raise ParseError(
                        Token(self.source, start, 'ERROR'),
                        'Unterminated string literal')

                if not raw and self.text[self.pos] == '\\':
                    self.pos += 1
                    ch = self.text[self.pos]
                    if ch not in ESCAPE_TABLE:
                        raise ParseError(
                            Token(self.source, self.pos, 'ERROR'),
                            'Invalid escape: ' + ch)
                    chars.append(ESCAPE_TABLE[ch])
                    self.pos += 1
                else:
                    chars.append(self.text[self.pos])
                    self.pos += 1

            self.pos += len(quote)
            value = ''.join(chars)
            return Token(self.source, start, 'STRING', value)

        # TYPENAME or NAME or KEYWORD
        if self.text[self.pos].isalpha() or self.text[self.pos] == '_':
            while (self.pos < len(self.text) and
                   (self.text[self.pos].isalnum() or
                    self.text[self.pos] == '_')):
                self.pos += 1
            value = self.text[start:self.pos]
            if value in KEYWORDS:
                return Token(self.source, start, value)
            elif (value in PRIMITIVE_TYPES or
                  (value[0].isupper() and
                   not value.isupper())):
                return Token(self.source, start, 'TYPENAME', value)
            else:
                return Token(self.source, start, 'NAME', value)

        # SYMBOL
        for symbol in SYMBOLS:
            if self.text.startswith(symbol, self.pos):
                self.pos += len(symbol)
                return Token(self.source, start, symbol)

        # ERROR
        while (self.pos < len(self.text) and
               not self.text[self.pos].isspace()):
            self.pos += 1
        raise ParseError(Token(self.source, start, 'ERROR'),
            'Invalid token: ' + self.text[start:self.pos])

def lex(source):
    lexer = Lexer(source)
    tokens = []
    while not lexer.done:
        tokens.append(lexer.next())
    return tokens


class Ast(object):
    def __init__(self, token):
        self.token = token

class FileInput(Ast):
    def __init__(self, token, uri, imports, interfaces, classes):
        super(FileInput, self).__init__(token)
        self.uri = uri  # string
        self.imports = imports  # [ImportDeclaration]
        self.interfaces = interfaces  # [InterfaceDefinition]
        self.classes = classes  # [ClassDefinition]

    def accept(self, visitor):
        return visitor.visit_file_input(self)

class ImportDeclaration(Ast):
    def __init__(self, token, uri, name, alias):
        super(ImportDeclaration, self).__init__(token)
        self.uri = uri  # string
        self.name = name  # string
        self.alias = alias  # string

    def accept(self, visitor):
        return visitor.visit_import_declaration(self)

class InterfaceDefinition(Ast):
    def __init__(self, token, name, bases, stubs):
        super(InterfaceDefinition, self).__init__(token)
        self.name = name  # string
        self.bases = bases  # [Typename]
        self.stubs = stubs  # [MethodStub]

    def accept(self, visitor):
        return visitor.visit_interface_definition(self)

class MethodStub(Ast):
    def __init__(self, token, returns, name, arglist):
        super(MethodStub, self).__init__(token)
        self.returns = returns  # Typename
        self.name = name  # string
        self.arglist = arglist  # [(Typename, string)]

    def accept(self, visitor):
        return visitor.visit_method_stub(self)

class ClassDefinition(Ast):
    def __init__(self, token, name, base, interfaces,
                 members, methods):
        super(ClassDefinition, self).__init__(token)
        self.name = name  # string
        self.base = base  # Typename
        self.interfaces = interfaces  # [Typename]
        self.members = members  # [MemberDefinition]
        self.methods = methods  # [MethodDefinition]

    def accept(self, visitor):
        return visitor.visit_class_definition(self)

class Typename(Ast):
    def __init__(self, token, name):
        super(Typename, self).__init__(token)
        self.name = name  # string

    def accept(self, visitor):
        return visitor.visit_typename(self)

class MemberDefinition(Ast):
    def __init__(self, token, is_static, type_, name):
        super(MemberDefinition, self).__init__(token)
        self.is_static = is_static  # bool
        self.type = type_  # Typename
        self.name = name  # string

    def accept(self, visitor):
        return visitor.visit_member_definition(self)

class MethodDefinition(Ast):
    def __init__(self, token, is_static, returns, name, arglist, body):
        super(MethodDefinition, self).__init__(token)
        self.is_static = is_static  # bool
        self.returns = returns  # Typename
        self.name = name  # string
        self.arglist = arglist  # [(Typename, string)]
        self.body = body  # Block

    def accept(self, visitor):
        return visitor.visit_method_definition(self)

class Statement(Ast):
    pass

class Block(Statement):
    def __init__(self, token, stmts):
        super(Block, self).__init__(token)
        self.stmts = stmts  # [Statement]

    def accept(self, visitor):
        return visitor.visit_block(self)

class VariableDeclaration(Statement):
    def __init__(self, token, type_, name, value):
        super(VariableDeclaration, self).__init__(token)
        self.type = type_  # Typename
        self.name = name  # string
        self.value = value  # Expression

    def accept(self, visitor):
        return visitor.visit_variable_declaration(self)

class IfStatement(Statement):
    def __init__(self, token, condition, body, other):
        super(IfStatement, self).__init__(token)
        self.condition = condition  # Expression
        self.body = body  # Block
        self.other = other  # Block|IfStatement|None

    def accept(self, visitor):
        return visitor.visit_if_statement(self)

class WhileStatement(Statement):
    def __init__(self, token, condition, body):
        super(WhileStatement, self).__init__(token)
        self.condition = condition  # Expression
        self.body = body  # Block

    def accept(self, visitor):
        return visitor.visit_while_statement(self)

class BreakStatement(Statement):
    def accept(self, visitor):
        return visitor.visit_break_statement(self)

class ContinueStatement(Statement):
    def accept(self, visitor):
        return visitor.visit_continue_statement(self)

class ReturnStatement(Statement):
    def __init__(self, token, return_value):
        super(ReturnStatement, self).__init__(token)
        self.return_value = return_value  # Expression

    def accept(self, visitor):
        return visitor.visit_return_statement(self)

class ExpressionStatement(Statement):
    def __init__(self, token, expression):
        super(ExpressionStatement, self).__init__(token)
        self.expression = expression

    def accept(self, visitor):
        return visitor.visit_expression_statement(self)

class Expression(Ast):
    def __init__(self, token):
        super(Expression, self).__init__(token)

        # Type to be deduced by the annotator
        # A deduced type consists of a (uri, name) pair,
        # where 'uri' is the uri of the FileInput and
        # 'name' is the name of the class in that uri.
        self.deduced_type = None

class StringLiteral(Expression):
    def __init__(self, token, value):
        super(StringLiteral, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_string_literal(self)

class FloatLiteral(Expression):
    def __init__(self, token, value):
        super(FloatLiteral, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_float_literal(self)

class IntLiteral(Expression):
    def __init__(self, token, value):
        super(IntLiteral, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_int_literal(self)

class NameExpression(Expression):
    def __init__(self, token, name):
        super(NameExpression, self).__init__(token)
        self.name = name  # string

    def accept(self, visitor):
        return visitor.visit_name_expression(self)

class AssignExpression(Expression):
    def __init__(self, token, name, value):
        suepr(AssignExpression, self).__init__(token)
        self.name = name  # string
        self.value = value  # Expression

    def accept(self, visitor):
        return visitor.visit_assign_expression(self)

class ListDisplay(Expression):
    def __init__(self, token, values):
        super(ListDisplay, self).__init__(token)
        self.values = values  # [Expression]

    def accept(self, visitor):
        return visitor.visit_list_display(self)

class NewExpression(Expression):
    def __init__(self, token, type_, args):
        super(NewExpression, self).__init__(token)
        self.type = type_  # Typename
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_new_expression(self)

class MethodCallExpression(Expression):
    def __init__(self, token, target, method_name, args):
        super(MethodCallExpression, self).__init__(token)
        self.target = target  # Expression
        self.method_name = method_name  # string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_method_call_expression(self)

class GetAttributeExpression(Expression):
    def __init__(self, token, target, attribute_name):
        super(GetAttributeExpression, self).__init__(token)
        self.target = target  # Expression
        self.attribute_name = attribute_name  # string

    def accept(self, visitor):
        return visitor.visit_get_attribute_expression(self)

class SetAttributeExpression(Expression):
    def __init__(self, token, target, attribute_name, value):
        super(SetAttributeExpression, self).__init__(token)
        self.target = target  # Expression
        self.attribute_name = attribute_name  # string
        self.value = value  # Expression

    def accept(self, visitor):
        return visitor.visit_set_attribute_expression(self)

class StaticMethodCallExpression(Expression):
    def __init__(self, token, type_, method_name, args):
        super(MethodCallExpression, self).__init__(token)
        self.type = type_  # Typename
        self.method_name = method_name  # string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_method_call_expression(self)

class GetStaticAttributeExpression(Expression):
    def __init__(self, token, type_, attribute_name):
        super(GetStaticAttributeExpression, self).__init__(token)
        self.type = type_  # Typename
        self.attribute_name = attribute_name  # string

    def accept(self, visitor):
        return visitor.visit_get_static_attribute_expression(self)

class SetStaticAttributeExpression(Expression):
    def __init__(self, token, type_, attribute_name, value):
        super(SetStaticAttributeExpression, self).__init__(token)
        self.type = type_  # Typename
        self.attribute_name = attribute_name  # string
        self.value = value  # Expression

    def accept(self, visitor):
        return visitor.visit_set_static_attribute_expression(self)

class AndExpression(Expression):
    def __init__(self, token, left, right):
        super(AndExpression, self).__init__(token)
        self.left = left  # Expression
        self.right = right  # Expression

    def accept(self, visitor):
        return visitor.visit_and_expression(self)

class OrExpression(Expression):
    def __init__(self, token, left, right):
        super(OrExpression, self).__init__(token)
        self.left = left  # Expression
        self.right = right  # Expression

    def accept(self, visitor):
        return visitor.visit_or_expression(self)

class TernaryExpression(Expression):
    def __init__(self, token, condition, left, right):
        super(TernaryExpression, self).__init__(token)
        self.condition = condition  # Expression
        self.left = left  # Expression
        self.right = right  # Expression

    def accept(self, visitor):
        return visitor.visit_ternary_expression(self)

class Parser(object):
    def __init__(self, source):
        self.source = source
        self.tokens = lex(source)
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos]

    def at(self, type_):
        return self.peek().type == type_

    def next_token(self):
        token = self.tokens[self.pos]
        self.pos += 1
        return token

    def expect(self, type_):
        if not self.at(type_):
            raise ParseError(
                self.peek(),
                "Expected %s but found %s" % (type_, self.peek()))
        return self.next_token()

    def consume(self, type_):
        if self.at(type_):
            return self.next_token()

    def parse_file_input(self):
        token = self.peek()
        uri = token.source.uri
        imports = []
        interfaces = []
        classes = []
        while self.consume('from'):
            uri = self.expect('STRING').value
            self.expect('import')
            name = self.expect('TYPENAME').value
            if self.consume('as'):
                alias = self.expect('TYPENAME').value
            else:
                alias = name
            imports.append(ImportDeclaration(token, uri, name, alias))

        while not self.at('EOF'):
            if self.at('interface'):
                interfaces.append(self.parse_interface_definition())
            elif self.at('class'):
                classes.append(self.parse_class_definition())
            else:
                raise ParseError(
                    self.peek(),
                    "Expected a class or interface definition")

        return FileInput(token, uri, imports, interfaces, classes)

    def parse_interface_definition(self):
        token = self.expect('interface')
        name = self.expect('TYPENAME').value
        bases = []
        if self.consume('extends'):
            bases.append(self.parse_typename())
            while self.consume(','):
                bases.append(self.parse_typename())
        stubs = []
        self.expect('{')
        while not self.consume('}'):
            stub_token = self.peek()
            returns = self.parse_typename()
            stub_name = self.expect('NAME').value
            arglist = self.parse_arglist()
            stubs.append(MethodStub(stub_token, returns, stub_name, arglist))
        return InterfaceDefinition(token, name, bases, stubs)

    def parse_typename(self):
        token = self.expect('TYPENAME')
        return Typename(token, token.value)

    def at_variable_declaration(self):
        return (self.at('TYPENAME') and
                self.pos + 1 < len(self.tokens) and
                self.tokens[self.pos + 1].type == 'NAME' and
                (self.pos + 2 >= len(self.tokens) or
                 self.tokens[self.pos + 2].type != '(')) # )

    def parse_arglist(self):
        self.expect(OPEN)
        arglist = []
        while not self.consume(CLOSE):
            argtype = self.parse_typename()
            argname = self.expect('NAME').value
            if not self.at(CLOSE):
                self.expect(',')
            arglist.append((argtype, argname))
        return arglist

    def parse_class_definition(self):
        token = self.expect('class')
        name = self.expect('TYPENAME').value
        if self.consume('extends'):
            base = self.parse_typename()
        else:
            base = None
        interfaces = []
        if self.consume('implements'):
            interfaces.append(self.parse_typename())
            while self.consume(','):
                interfaces.append(self.parse_typename())
        members = []
        methods = []
        self.expect('{')
        while not self.consume('}'):
            if self.consume('static'):
                is_static = True
            else:
                is_static = False
            type_ = self.parse_typename()
            member_name = self.expect('NAME').value
            if self.consume(';'):
                members.append(MemberDefinition(
                    token, is_static, type_, member_name))
            else:
                arglist = self.parse_arglist()
                body = self.parse_block()
                methods.append(MethodDefinition(
                    token, is_static, type_, member_name, arglist, body))
        return ClassDefinition(
            token, name, base, interfaces, members, methods)

    def parse_block(self):
        token = self.expect('{')
        stmts = []
        while not self.consume('}'):
            stmts.append(self.parse_statement())
        return Block(token, stmts)

    def parse_if_statement(self):
        token = self.expect('if')
        cond = self.parse_expression()
        body = self.parse_block()
        if self.consume('else'):
            if self.at('if'):
                other = self.parse_if_statement()
            else:
                other = self.parse_block()
        else:
            other = None
        return IfStatement(token, cond, body, other)

    def parse_statement(self):
        token = self.peek()
        if self.at('{'):
            return self.parse_block()
        elif self.at_variable_declaration():
            type_ = self.parse_typename()
            name = self.expect('NAME').value
            if self.consume('='):
                value = self.parse_expression()
            else:
                value = None
            return VariableDeclaration(token, type_, name, value)
        elif self.at('if'):
            return self.parse_if_statement()
        elif self.consume('while'):
            cond = self.parse_expression()
            body = self.parse_block()
            return WhileStatement(token, cond, body)
        elif self.consume('continue'):
            self.expect(';')
            return ContinueStatement(token)
        elif self.consume('break'):
            self.expect(';')
            return BreakStatement(token)
        elif self.consume('return'):
            expr = self.parse_expression()
            self.expect(';')
            return ReturnStatement(token, expr)
        else:
            expr = self.parse_expression()
            self.expect(';')
            return ExpressionStatement(token, expr)

    def parse_expression(self):
        return self.parse_primary_expression()

    def parse_primary_expression(self):
        token = self.peek()
        if self.consume('('):
            expr = self.parse_expression()
            self.expect(')')
            return expr
        elif self.consume('STRING'):
            return StringLiteral(token, token.value)
        else:
            raise Exception()  # TODO: ParseError

def parse(source):
    return Parser(source).parse_file_input()




