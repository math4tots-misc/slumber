
class Ast(object):
    def __init__(self, token):
        self.token = token

class FileInput(Ast):
    def __init__(self, token, package, imports, interfaces, classes):
        super(FileInput, self).__init__(token)
        self.package = package  # [string]
        self.imports = imports  # [ImportDeclaration]
        self.interfaces = interfaces  # [InterfaceDefinition]
        self.classes = classes  # [ClassDefinition]

    def accept(self, visitor):
        return visitor.visit_file_input(self)

class ImportDeclaration(Ast):
    def __init__(self, token, package, name, alias):
        super(ImportDeclaration, self).__init__(token)
        self.package = package  # [string]
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

        # To be filled in by annotator
        self.full_name = None  # string

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

        # To be filled in by annotator
        self.deduced_type = None  # string

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

class SuperMethodCallExpression(Expression):
    def __init__(self, token, method_name, args):
        super(SuperMethodCallExpression, self).__init__(token)
        self.method_name = method_name  # string
        self.args = args  # [Expression]

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
        super(StaticMethodCallExpression, self).__init__(token)
        self.type = type_  # Typename
        self.method_name = method_name  # string
        self.args = args  # [Expression]

    def accept(self, visitor):
        return visitor.visit_static_method_call_expression(self)

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

class NotExpression(Expression):
    def __init__(self, token, target):
        super(NotExpression, self).__init__(token)
        self.target = target  # Expression

    def accept(self, visitor):
        return visitor.visit_not_expression(self)

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
