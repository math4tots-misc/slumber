"""bbannotator.py

LKSDJFLKSJDFLKSJDF

Do a serious rewrite at some point
"""

# TODO: THERE ARE SO MANY TODO's to do here. Right now I'm just going for
# minimal working prototype. But there is so much to do here, for instance,
# actually check that when a class claims that it implements an interface,
# that all the methods are implemented. Also that there are no class
# attribute clashes in the inheritance chain. And make the code cleaner...
# Also, methods with same name, even if one is member and one is static
# causes clash.
# SO MUCH TO DO!!!

import bbparser

CompileError = bbparser.CompileError


def extract_type_data(classes):
    """TODO: BURN THIS and replace with something better"""
    class_from_name = {c.qualified_typename: c for c in classes}

    # Sorry, I know this is like, the worst name
    data = {'bb.lang.Object': dict()}

    working_on_it = set()

    def recurse(class_name):
        if class_name not in data:
            klass = class_from_name[class_name]
            if class_name in working_on_it:
                raise CompileError(
                    klass.token,
                    'Infinite recursion in inheritance: ' + class_name)
            working_on_it.add(class_name)
            d = dict(recurse(klass.base))
            for member in klass.members:
                if member.name in d:
                    raise CompileError(
                        klass.token,
                        'Tried to define duplicate member: %s.%s' % (
                            klass.name, member.name))
                d[member.name] = member.type
            for method in klass.methods:
                if method.name in d and isinstance(d[method.name], str):
                    raise CompileError(
                        klass.token,
                        'Tried to hide member by defining method: '
                        '%s.%s(..)' % (klass.name, method.name))
                d[method.name] = (
                    method.returns,
                    tuple(type_ for type_, name in method.args))
            working_on_it.remove(class_name)
            data[class_name] = d
        return data[class_name]

    for name in class_from_name:
        recurse(name)

    return data



class Annotator(object):
    def __init__(self, type_data):
        self.type_data = type_data
        self.scopes = []

    def push_scope(self):
        self.scopes.append(dict())

    def pop_scope(self):
        self.scopes.pop()

    def declare_var(self, type_, name):
        self.scopes[-1][name] = type_

    def get_var_type(self, name, token):
        for scope in reversed(self.scopes):
            if name in scope:
                return scope[name]
        raise TranspileError(
            token, "No such variable named '" + name + "' at this scope")

    def visit(self, node):
        return node.accept(self)

    def visit_class(self, node):
        for method in node.methods:
            self.push_scope()
            for type_, name in method.args:
                self.declare_var(type_, name)
            self.visit(method.body)
            self.pop_scope()

    def visit_method_call(self, node):
        self.visit(node.owner)
        for arg in node.args:
            self.visit(arg)
        t = self.type_data[node.owner.deduced_type][node.method_name]
        if isinstance(t, str):
            raise TranspileError(
                node.token,
                "Tried to call member like a method: %s.%s" % (
                node.owner.deduced_type, node.method_name))
        returns, argtypes = t
        argts = tuple(arg.deduced_type for arg in argtypes)
        if argtypes != argts:
            raise TranspileError(
                node.token,
                "Expected args don't match actual args: %s.%s" % (
                node.owner.deduced_type, node.method_name))
        node.deduced_type = returns

    def visit_get_attribute(self, node):
        self.visit(node.owner)
        t = self.type_data[node.owner.deduced_type][node.attribute_name]
        if isinstance(t, tuple):
            raise TranspileError(
                node.token,
                "Tried to use method like a member: %s.%s" % (
                node.owner.deduced_type, node.attribute_name))
        node.deduced_type = t

    def visit_new(self, node):
        node.deduced_type = node.type

    def visit_int(self, node):
        if not node.deduced_type:
            node.deduced_type = 'int'

    def visit_float(self, node):
        if not node.deduced_type:
            node.deduced_type = 'float'

    def visit_string(self, node):
        if not node.deduced_type:
            node.deduced_type = 'bb.lang.String'


def annotate(classes):
    type_data = extract_type_data(classes)
    for c in classes:
        Annotator(type_data).visit(c)





