"""bbparser.py
"""
import bblexer
import bbast

OPEN_BRACKET = bblexer.OPEN_BRACKET
CLOSE_BRACKET = bblexer.CLOSE_BRACKET
OPEN_PARENTHESIS = bblexer.OPEN_PARENTHESIS
CLOSE_PARENTHESIS = bblexer.CLOSE_PARENTHESIS
OPEN_CURLEY = '{'
CLOSE_CURLEY = '}'

Source = bblexer.Source
ParseError = bblexer.ParseError

PRIMITIVE_TYPES = bblexer.PRIMITIVE_TYPES
BUILTIN_TYPES = {
    'String', 'List',
}


class Parser(object):
    def __init__(self, source):
        self.source = source
        self.tokens = bblexer.lex(source)
        self.pos = 0

        # Module level variables
        # I feel a tad bit iffy about these member variables
        # -- it almost feels like these should be passed down as
        # arguments.
        # On the other hand, each 'Parser' object should correspond to
        # at most one parse of one module, so when set, they should be
        # unique to the Parser instance.
        self.alias_table = dict()
        self.package = ''

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

    def parse_module(self):
        token = self.peek()

        if self.at('STRING'):
            doc = self.expect('STRING').value
        else:
            doc = None

        self.expect('package')
        self.package = self.parse_package_name()

        imports = []
        while self.at('import'):
            imports.append(self.parse_and_process_import())

        classes = []
        while not self.at('EOF'):
            classes.append(self.parse_class())

        return bbast.Module(token, doc, self.package, imports, classes)

    def parse_package_name(self):
        package_items = []
        package_items.append(self.expect('NAME').value)
        while self.consume('.'):
            package_items.append(self.expect('NAME').value)
        self.expect(';')
        return '.'.join(package_items)

    def parse_and_process_import(self):
        self.expect('import')
        package_items = []
        while not self.at('TYPENAME'):
            package_items.append(self.expect('NAME').value)
            self.expect('.')
        name = self.expect('TYPENAME').value

        if self.consume('as'):
            alias = self.expect('TYPENAME').value
        else:
            alias = name
        self.expect(';')

        qualified_name = '.'.join(package_items) + '.' + name

        self.alias_table[alias] = qualified_name

        return qualified_name

    def parse_class(self):
        token = self.peek()

        if self.consume('interface'):
            is_interface = True
        else:
            self.expect('class')
            is_interface = False

        class_name = self.expect('TYPENAME').value

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

        if self.at('STRING'):
            doc = self.consume('STRING').value
        else:
            doc = None

        while not self.consume('}'):
            member_token = self.peek()

            if self.consume('static'):
                is_static = True
            else:
                is_static = False
            type_ = self.parse_typename()
            member_name = self.expect('NAME').value
            if self.consume(';'):
                if is_interface:
                    raise ParseError(
                        member_token,
                        "Member declarations are not allowed inside "
                        "interfaces")

                if self.at('STRING'):
                    member_doc = self.expect('STRING').value
                else:
                    member_doc = None

                members.append(bbast.Member(
                    token=member_token, doc=member_doc, is_static=is_static,
                    type_=type_, name=member_name))
            else:
                self.expect(OPEN_PARENTHESIS)
                args = []
                while not self.consume(CLOSE_PARENTHESIS):
                    argtype = self.parse_typename()
                    argname = self.expect('NAME').value
                    args.append((argtype, argname))
                    if not self.at(CLOSE_PARENTHESIS):
                        self.expect(',')

                if self.consume(';'):
                    if not is_interface:
                        raise ParseError(
                            member_token,
                            'Abstract methods are not supported')
                    if self.at('STRING'):
                        member_doc = self.expect('STRING').value
                    else:
                        member_doc = None
                    body = None
                else:
                    if is_interface:
                        raise ParseError(
                            member_token,
                            'Interface method implementations are not yet '
                            'supported')

                    if (self.pos + 2 < len(self.tokens) and
                            self.tokens[self.pos + 1].type == 'STRING' and
                            self.tokens[self.pos + 2].type == ';'):
                        body_token = self.expect('{')
                        member_doc = self.expect('STRING').value
                        self.expect(';')
                        stmts = []
                        while not self.consume('}'):
                            stmts.append(self.parse_statement())
                        body = bbast.Block(body_token, stmts)
                    else:
                        body = self.parse_block()

                methods.append(bbast.Method(
                    token=member_token, doc=member_doc, is_static=is_static,
                    returns=type_, name=member_name,
                    args=args, body=body))

        return bbast.Class(
            token=token, doc=doc, is_interface=is_interface,
            package=self.package, name=class_name,
            base=base, interfaces=interfaces,
            members=members, methods=methods)

    def parse_typename(self):
        name = self.expect('TYPENAME').value
        if name in PRIMITIVE_TYPES:
            return name
        elif name in BUILTIN_TYPES:
            return 'bb.lang.' + name
        elif name in self.alias_table:
            return self.alias_table[name]
        else:
            return self.package + '.' + name

    def parse_block(self):
        token = self.expect(OPEN_CURLEY)
        stmts = []
        while not self.consume(CLOSE_CURLEY):
            stmts.append(self.parse_statement())
        return bbast.Block(token, stmts)

    def parse_statement(self):
        token = self.peek()
        if self.at(OPEN_CURLEY):
            return self.parse_block()
        else:
            expr = self.parse_expression()
            self.expect(';')
            return bbast.ExpressionStatement(token, expr)

    def parse_expression_list(self, open_, close):
        self.expect(open_)
        args = []
        while not self.consume(close):
            args.append(self.parse_expression())
            if not self.at(close):
                self.expect(',')
        return args

    def parse_expression(self):
        return self.parse_postfix_expression()

    def parse_postfix_expression(self):
        expr = self.parse_primary_expression()
        while True:
            token = self.peek()
            if self.consume('.'):
                name = self.expect('NAME').value
                if self.at(OPEN_PARENTHESIS):
                    args = self.parse_expression_list('(', ')')
                    expr = bbast.MethodCall(token, expr, name, args)
                elif self.consume('='):
                    rhs = self.parse_expression()
                    expr = bbast.SetAttribute(token, expr, name, rhs)
                else:
                    expr = bbast.GetAttribute(token, expr, name)
            else:
                break
        return expr

    def parse_primary_expression(self):
        token = self.peek()

        if self.consume('('):
            expr = self.parse_expression()
            self.expect(')')
            return expr

        if self.consume('this'):
            return bbast.This(token)

        if self.consume('null'):
            return bbast.Null(token)

        if self.consume('true'):
            return bbast.TrueExpression(token)

        if self.consume('false'):
            return bbast.FalseExpression(token)

        if self.consume('NAME'):
            name = token.value
            if self.consume('='):
                rhs = self.parse_expression()
                return bbast.Assign(token, name, rhs)
            else:
                return bbast.Name(token, name)

        if self.consume('INT'):
            return bbast.Int(token, token.value)

        if self.consume('FLOAT'):
            return bbast.Float(token, token.value)

        if self.consume('STRING'):
            return bbast.String(token, token.value)

        if self.at('TYPENAME'):
            type_ = self.parse_typename()
            if self.at(OPEN_PARENTHESIS):
                args = self.parse_expression_list('(', ')')
                return bbast.New(token, type_, args)
            else:
                self.expect('.')
                name = self.expect('NAME').value
                if self.at(OPEN_PARENTHESIS):
                    args = self.parse_expression_list('(', ')')
                    return bbast.StaticMethodCall(token, type_, name, args)
                elif self.consume('='):
                    expr = self.parse_expression()
                    return bbast.SetStaticAttribute(token, type_, name, expr)
                else:
                    return bbast.GetStaticAttribute(token, type_, name)

        raise ParseError(token, 'Expected expression but got %r' % token)


def parse(source):
    return Parser(source).parse_module()
