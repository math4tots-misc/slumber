import unittest
import bbast

def make_ast_equality_func(failureException):
    def equality_func(a, b):
        if

        if type(a) != type(b):
            return False

        attrs = tuple(set(dir(a)) - set(dir(bbast.Ast)))

        for attr in attrs:
            if getattr(a, attr) != getattr

