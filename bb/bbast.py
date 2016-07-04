"""bbast.py

package-string is a string consisting of NAMEs separated by dots.
For instance, "java.util" is a package-string.

qualified-typename is either
    1) the name of a primitive type, that is, one of
        a) void
        b) bool
        c) int
        d) float
    2) a package-string appended by a dot and a TYPENAME.
        For instance, "java.util.ArrayList" is a qualified-typename.

"""

class Ast(object):
    def __init__(self, token):
        self.token = token


class Module(Ast):
    def __init__(self, token, doc, package, imports, classes):
        super(Module, self).__init__(token)
        self.doc = doc  # string|None
        self.package = package  # package-string
        self.imports = imports  # [qualified-typename]
        self.classes = classes  # [Class]

    def accept(self, visitor):
        return visitor.visit_module(self)


class Class(Ast):
    def __init__(self, token, doc, is_interface, package, name,
                 base, interfaces, members, methods):
        super(Class, self).__init__(token)
        self.is_interface = is_interface  # bool
        self.doc = doc  # string|None
        self.package = package  # package-string
        self.name = name  # TYPENAME-string
        self.base = base  # qualified-typename
        self.interfaces = interfaces  # [qualified-typename]
        self.members = members  # [Member]
        self.methods = methods  # [Method]

    @property
    def qualified_typename(self):
        return self.package + '.' + self.name

    def accept(self, visitor):
        return visitor.visit_class(self)


class Member(Ast):
    def __init__(self, token, doc, is_static, type_, name):
        super(Member, self).__init__(token)
        self.doc = doc  # string|None
        self.is_static = is_static  # bool
        self.type = type_  # qualified-typename
        self.name = name  # NAME-string

    def accept(self, visitor):
        return visitor.visit_member(self)


class Method(Ast):
    def __init__(self, token, doc, is_static, returns, name, args, body):
        super(Method, self).__init__(token)
        self.doc = doc  # string
        self.is_static = is_static  # bool
        self.returns = returns  # qualified-typename
        self.name = name  # NAME-string
        self.args = args  # [(qualified-typename, NAME-string)]
        self.body = body  # Block|None

    def accept(self, visitor):
        return visitor.visit_method(self)


class Statement(Ast):
    pass


class Block(Statement):
    def __init__(self, token, statements):
        super(Block, self).__init__(token)
        self.statements = statements  # [Statement]

    def accept(self, visitor):
        return visitor.visit_block(self)


class Declaration(Statement):
    def __init__(self, token, type_, name):
        super(Declaration, self).__init__(token)
        self.type = type_  # qualified-typename
        self.name = name  # NAME-string

    def accept(self, visitor):
        return visitor.visit_declaration(self)


class If(Statement):
    def __init__(self, token, condition, body, other):
        super(If, self).__init__(token)
        self.condition = condition  # Expression
        self.body = body  # Block
        self.other = other  # Block|If|None

    def accept(self, visitor):
        return visitor.visit_if(self)


class While(Statement):
    def __init__(self, token, condition, body):
        super(While, self).__init__(token)
        self.condition = condition  # Expression
        self.body = body  # Block

    def accept(self, visitor):
        return visitor.visit_while(self)


class Break(Statement):
    def accept(self, visitor):
        return visitor.visit_break(self)


class Continue(Statement):
    def accept(self, visitor):
        return visitor.visit_continue(self)


class Return(Statement):
    def __init__(self, token, expr):
        super(Return, self).__init__(token)
        self.expr = expr  # Expression

    def accept(self, visitor):
        return visitor.visit_return(self)


class ExpressionStatement(Statement):
    def __init__(self, token, expr):
        super(ExpressionStatement, self).__init__(token)
        self.expr = expr  # Expression

    def accept(self, visitor):
        return visitor.visit_expression_statement(self)


class Expression(Ast):
    def __init__(self, token):
        super(Expression, self).__init__(token)

        # This is set to None during the parse phase,
        # but is filled in during the annotation phase when
        # we have access to all the source files so that we
        # have enough information to deduce all types.
        self.deduced_type = None  # qualified-typename


class Assign(Expression):
    def __init__(self, token, name, expr):
        super(Assign, self).__init__(token)
        self.name = name  # NAME-string
        self.expr = expr  # Expression

    def accept(self, visitor):
        return visitor.visit_assign(self)


class Name(Expression):
    def __init__(self, token, name):
        super(Name, self).__init__(token)
        self.name = name  # NAME-string

    def accept(self, visitor):
        return visitor.visit_name(self)


class This(Expression):
    def accept(self, visitor):
        return visitor.visit_this(self)


class Null(Expression):
    def accept(self, visitor):
        return visitor.visit_null(self)


class True(Expression):
    def accept(self, visitor):
        return visitor.visit_true(self)


class False(Expression):
    def accept(self, visitor):
        return visitor.visit_false(self)


class Int(Expression):
    def __init__(self, token, value):
        super(Int, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_int(self)


class Float(Expression):
    def __init__(self, token, value):
        super(Float, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_float(self)


class String(Expression):
    def __init__(self, token, value):
        super(String, self).__init__(token)
        self.value = value  # string

    def accept(self, visitor):
        return visitor.visit_string(self)


class List(Expression):
    def __init__(self, token, args):
        super(List, self).__init__(token)
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_list(self)


class New(Expression):
    def __init__(self, token, type_, args):
        super(New, self).__init__(token)
        self.type = type_  # qualified-typename
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_new(self)


class SuperMethodCall(Expression):
    def __init__(self, token, method_name, args):
        super(SuperMethodCall, self).__init__(token)
        self.method_name = method_name  # NAME-string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_super_method_call(self)


class MethodCall(Expression):
    def __init__(self, token, owner, method_name, args):
        super(MethodCall, self).__init__(token)
        self.owner = owner  # Expression
        self.method_name = method_name  # NAME-string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_method_call(self)


class GetAttribute(Expression):
    def __init__(self, token, owner, attribute_name):
        super(GetAttribute, self).__init__(token)
        self.owner = owner  # Expression
        self.attribute_name = attribute_name  # NAME-string

    def accept(self, visitor):
        return visitor.visit_get_attribute(self)


class SetAttribute(Expression):
    def __init__(self, token, owner, attribute_name, expr):
        super(SetAttribute, self).__init__(token)
        self.owner = owner  # Expression
        self.attribute_name = attribute_name  # NAME-string
        self.expr = expr  # Expression

    def accept(self, visitor):
        return visitor.visit_set_attribute(self)


class StaticMethodCall(Expression):
    def __init__(self, token, type_, method_name, args):
        super(StaticMethodCall, self).__init__(token)
        self.type = type_  # qualified-typename
        self.method_name = method_name  # NAME-string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_method_call(self)


class GetStaticAttribute(Expression):
    def __init__(self, token, type_, attribute_name):
        super(GetStaticAttribute, self).__init__(token)
        self.type = type_  # qualified-typename
        self.attribute_name = attribute_name  # NAME-string

    def accept(self, visitor):
        return visitor.visit_get_static_attribute(self)


class SetStaticAttribute(Expression):
    def __init__(self, token, type_, attribute_name, expr):
        super(SetStaticAttribute, self).__init__(token)
        self.type = type_  # qualified-typename
        self.attribute_name = attribute_name  # NAME-string
        self.expr = expr  # Expression

    def accept(self, visitor):
        return visitor.visit_set_static_attribute(self)





