import sleeplexer as lexer
import sleepast as ast


OPEN_BRACKET = lexer.OPEN_BRACKET
CLOSE_BRACKET = lexer.CLOSE_BRACKET
OPEN_PARENTHESIS = lexer.OPEN_PARENTHESIS
CLOSE_PARENTHESIS = lexer.CLOSE_PARENTHESIS

Source = lexer.Source
ParseError = lexer.ParseError


class Parser(object):
    def __init__(self, source):
        self.source = source
        self.tokens = lexer.lex(source)
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
        package = []
        imports = []
        interfaces = []
        classes = []

        if self.consume('package'):
            package.append(self.expect('NAME').value)
            while self.consume('.'):
                package.append(self.expect('NAME').value)

        while self.consume('import'):
            pkg = []
            while self.at('NAME'):
                pkg.append(self.expect('NAME').value)
                self.consume('.')
            name = self.expect('TYPENAME').value
            if self.consume('as'):
                alias = self.expect('TYPENAME').value
            else:
                alias = name
            imports.append(ast.ImportDeclaration(token, pkg, name, alias))

        while not self.at('EOF'):
            if self.at('interface'):
                interfaces.append(self.parse_interface_definition())
            elif self.at('class'):
                classes.append(self.parse_class_definition())
            else:
                raise ParseError(
                    self.peek(),
                    "Expected a class or interface definition")

        return ast.FileInput(token, package, imports, interfaces, classes)

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
            stubs.append(ast.MethodStub(
                stub_token, returns, stub_name, arglist))
        return ast.InterfaceDefinition(token, name, bases, stubs)

    def parse_typename(self):
        token = self.expect('TYPENAME')
        return ast.Typename(token, token.value)

    def at_variable_declaration(self):
        return (self.at('TYPENAME') and
                self.pos + 1 < len(self.tokens) and
                self.tokens[self.pos + 1].type == 'NAME' and
                (self.pos + 2 >= len(self.tokens) or
                 self.tokens[self.pos + 2].type != '(')) # )

    def parse_arglist(self):
        self.expect(OPEN_PARENTHESIS)
        arglist = []
        while not self.consume(CLOSE_PARENTHESIS):
            argtype = self.parse_typename()
            argname = self.expect('NAME').value
            arglist.append((argtype, argname))
            if not self.at(CLOSE_PARENTHESIS):
                self.expect(',')
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
                methods.append(ast.MethodDefinition(
                    token, is_static, type_, member_name, arglist, body))
        return ast.ClassDefinition(
            token, name, base, interfaces, members, methods)

    def parse_block(self):
        token = self.expect('{')
        stmts = []
        while not self.consume('}'):
            stmts.append(self.parse_statement())
        return ast.Block(token, stmts)

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
        return ast.IfStatement(token, cond, body, other)

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
            return ast.VariableDeclaration(token, type_, name, value)
        elif self.at('if'):
            return self.parse_if_statement()
        elif self.consume('while'):
            cond = self.parse_expression()
            body = self.parse_block()
            return ast.WhileStatement(token, cond, body)
        elif self.consume('continue'):
            self.expect(';')
            return ast.ContinueStatement(token)
        elif self.consume('break'):
            self.expect(';')
            return ast.BreakStatement(token)
        elif self.consume('return'):
            expr = self.parse_expression()
            self.expect(';')
            return ast.ReturnStatement(token, expr)
        else:
            expr = self.parse_expression()
            self.expect(';')
            return ast.ExpressionStatement(token, expr)

    def parse_expression(self):
        return self.parse_ternary_expression()

    def parse_ternary_expression(self):
        expr = self.parse_or_expression()
        token = self.peek()
        if self.consume('?'):
            lhs = self.parse_expression()
            self.expect(':')
            rhs = self.parse_ternary_expression()
            return ast.TernaryExpression(token, expr, lhs, rhs)
        return expr

    def parse_or_expression(self):
        expr = self.parse_and_expression()
        while True:
            token = self.peek()
            if self.consume('or'):
                rhs = self.parse_and_expression()
                expr = OrExpression(token, expr, rhs)
            else:
                break
        return expr

    def parse_and_expression(self):
        expr = self.parse_not_expression()
        while True:
            token = self.peek()
            if self.consume('and'):
                rhs = self.parse_not_expression()
                expr = AndExpression(token, expr, rhs)
            else:
                break
        return expr

    def parse_not_expression(self):
        token = self.peek()
        if self.consume('not'):
            return ast.NotExpression(token, self.parse_comparison_expression())
        else:
            return self.parse_comparison_expression()

    def parse_comparison_expression(self):
        # TODO: Treat comparison chaining in a special way:
        # e.g. 'a == b == c' should be equivalent to 'a == b and b == c'
        # Until then, simply don't allow chaining.
        expr = self.parse_additive_expression()
        token = self.peek()
        if self.consume('<'):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__lt__', [rhs])
        if self.consume('<='):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__le__', [rhs])
        if self.consume('>'):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__gt__', [rhs])
        if self.consume('>='):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__ge__', [rhs])
        if self.consume('=='):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__eq__', [rhs])
        if self.consume('!='):
            rhs = self.parse_additive_expression()
            return ast.MethodCallExpression(token, expr, '__ne__', [rhs])

        return expr

    def parse_additive_expression(self):
        expr = self.parse_multiplicative_expression()
        while True:
            token = self.peek()
            if self.consume('+'):
                rhs = self.parse_multiplicative_expression()
                expr = ast.MethodCallExpression(token, expr, '__add__', [rhs])
            elif self.consume('-'):
                rhs = self.parse_multiplicative_expression()
                expr = ast.MethodCallExpression(token, expr, '__sub__', [rhs])
            else:
                break
        return expr

    def parse_multiplicative_expression(self):
        expr = self.parse_prefix_expression()
        while True:
            token = self.peek()
            if self.consume('*'):
                rhs = self.parse_prefix_expression()
                expr = ast.MethodCallExpression(token, expr, '__mul__', [rhs])
            elif self.consume('/'):
                rhs = self.parse_prefix_expression()
                expr = ast.MethodCallExpression(token, expr, '__div__', [rhs])
            elif self.consume('%'):
                rhs = self.parse_prefix_expression()
                expr = ast.MethodCallExpression(token, expr, '__mod__', [rhs])
            else:
                break
        return expr

    def parse_prefix_expression(self):
        token = self.peek()
        if self.consume('-'):
            return ast.MethodCallExpression(
                token, self.parse_postfix_expression(), '__neg__', [])
        elif self.consume('+'):
            return ast.MethodCallExpression(
                token, self.parse_postfix_expression(), '__neg__', [])
        return self.parse_postfix_expression()

    def parse_postfix_expression(self):
        expr = self.parse_primary_expression()
        while True:
            token = self.peek()
            if self.consume('.'):
                name = self.expect('NAME').value
                if self.consume(OPEN_PARENTHESIS):
                    args = []
                    while not self.consume(CLOSE_PARENTHESIS):
                        args.append(self.parse_expression())
                        if not self.at(CLOSE_PARENTHESIS):
                            self.expect(',')
                    expr = ast.MethodCallExpression(token, expr, name, args)
                elif self.consume('='):
                    value = self.parse_expression()
                    expr = SetAttributeExpression(token, expr, name, value)
                else:
                    expr = GetAttributeExpression(token, expr, name)
            else:
                break
        return expr

    def parse_primary_expression(self):
        token = self.peek()
        if self.consume('('):
            expr = self.parse_expression()
            self.expect(')')
            return expr
        elif self.consume('NAME'):
            if self.consume('='):
                value = self.parse_expression()
                return ast.AssignExpression(token, token.value, value)
            else:
                return ast.NameExpression(token, token.value)
        elif self.consume('INT'):
            return ast.IntLiteral(token, token.value)
        elif self.consume('FLOAT'):
            return ast.FloatLiteral(token, token.value)
        elif self.consume('STRING'):
            return ast.StringLiteral(token, token.value)
        elif self.consume(OPEN_BRACKET):
            exprs = []
            while not self.consume(CLOSE_BRACKET):
                exprs.append(self.parse_expression())
                if not self.at(CLOSE_BRACKET):
                    self.expect(',')
            return ast.ListDisplay(token, exprs)
        elif self.at('TYPENAME'):
            type_ = self.parse_typename()
            token = self.peek()
            if self.consume(OPEN_PARENTHESIS):
                args = []
                while not self.consume(CLOSE_PARENTHESIS):
                    args.append(self.parse_expression())
                    if not self.at(CLOSE_PARENTHESIS):
                        self.expect(',')
                return ast.NewExpression(token, type_, args)
            elif self.consume('.'):
                name = self.expect('NAME').value
                if self.consume(OPEN_PARENTHESIS):
                    args = []
                    while not self.consume(CLOSE_PARENTHESIS):
                        args.append(self.parse_expression())
                        if not self.at(CLOSE_PARENTHESIS):
                            self.expect(',')
                    return ast.StaticMethodCallExpression(
                        token, type_, name, args)
                elif self.consume('='):
                    value = self.parse_expression()
                    return ast.SetStaticAttributeExpression(
                        token, type_, name, value)
                else:
                    return ast.GetStaticAttributeExpression(
                        token, type_, name)
            else:
                raise ParseError(token, "Expected static method call")
        elif self.consume('super'):
            self.expect('.')
            method_name = self.expect('NAME').value
            self.expect(OPEN_PARENTHESIS)
            args = []
            while not self.consume(CLOSE_PARENTHESIS):
                args.append(self.parse_expression())
                if not self.at(CLOSE_PARENTHESIS):
                    self.expect(',')
            return ast.SuperMethodCallExpression(token, method_name, args)

        raise ParseError(self.peek(), "Expected expression")

def parse(source):
    return Parser(source).parse_file_input()

