"""slumber.py

python slumber.py js root sample.sl sample.js && node sample.js

Some concepts in the language:

* No eval
Dynamic evaluation of code not allowed. To make transpiling easier.

* decorators
Like in Python. But probably not going to be as flexible.
Decorators on methods are going to need to return functions.

* functions/classes/methods
Pretty standard stuff.

* separation between statement and expression
I think procedural languages that do grouping based on indentation
that don't do this separation are harder to write maintainable code in.
The only language I can think of is coffeescript. And as fun as coffeescript
is, I  think it suffers in many ways because of this.

* generators
Like in Python. Pretty straight forward. I'm not sure if I want to
implement 'yield from' though. I do plan on supporting 'send'.

* promises
Like in javascript and twisted. I feel like promises are more explicit than
async/await. With async/await, it's not clear to me how the stack frames
are handled. With promsies, in a single threaded environment, all queued
code chunks wait until the stack frame is empty before starting. With
async/await, it seems as though stack frames are saved behind your
back during calls to await.

* sync blocks (maybe)
This will be a no-op in environmnts that are single threaded, but in theory
promises may be carried out in a multithreaded manner. In order to maintain
certain guarantees about internal state in multithreaded environments with
asychronous promises, sync blocks may be useful.

* async/await (maybe)
Modeled after: https://msdn.microsoft.com/en-us/library/mt674882.aspx
I think Python's async/await is similar, but I felt that the explanation
there was more clear than other explanations of the concept I've found.

"""
import os
import sys

#### native prludes

DIR = os.path.dirname(os.path.realpath(__file__))

with open(os.path.join(DIR, 'prelude.js')) as f:
  JS_PRELUDE = f.read()

if JS_PRELUDE.startswith('/* jshint esversion: 6 */'):
  JS_PRELUDE = JS_PRELUDE[len('/* jshint esversion: 6 */'):]

#### lexer

class Source(object):
  def __init__(self, uri, text):
    self.uri = uri.replace('\\', '/')
    self.text = text

class Token(object):
  def __init__(self, source, cursor, type_, value=None):
    self.source = source
    self.cursor = cursor
    self.type = type_
    self.value = value

  @property
  def line_number(self):
    return self.source.text.count('\n', 0, self.cursor) + 1

  @property
  def column_number(self):
    return self.cursor - self.source.text.rfind('\n', 0, self.cursor)

  @property
  def line(self):
    a = self.source.text.rfind('\n', 0, self.cursor) + 1
    b = self.source.text.find('\n', self.cursor)
    if b == -1:
      b = len(self.source.text)
    return self.source.text[a:b]

  @property
  def location_message(self):
    return '\nFile "%s", line %d\n%s\n%s*' % (
        self.source.uri, self.line_number,
        self.line,
        ' ' * (self.column_number-1))

  def __repr__(self):
    return 'Token(source, %d, %r, %r)' % (self.cursor, self.type, self.value)

class ParseError(Exception):
  def __init__(self, token, message):
    super(ParseError, self).__init__(
        '%s\n%s' % (token.location_message, message))
    self.token = token
    self.message = message

KEYWORDS = set([
  # keywords from Python
  'False', 'class', 'finally', 'is', 'return',
  'None', 'continue', 'for', 'lambda', 'try',
  'True', 'def', 'from', 'nonlocal', 'while',
  'and', 'del', 'global', 'not', 'with',
  'as', 'elif', 'if', 'or', 'yield',
  # 'assert',  # assert is not a keyword in slumber
  'else', 'import', 'pass',
  'break', 'except', 'in', 'raise',
  # my keywords
  'async', 'await', 'self',
])

SYMBOLS = tuple(reversed(sorted([
  # operators
  '+', '-', '*', '**', '/', '//', '%', '@',
  '<<', '>>', '&', '|', '^', '~',
  '<', '>', '<=', '>=', '==', '!=',
  # delimiters
  '(', ')', '[', ']', '{', '}',
  ',', ':', '.', ';', '@', '=', '->',
  '+=', '-=', '*=', '/=', '//=', '%=', '@=',
  '&=', '|=', '^=', '>>=', '<<=', '**=',
  # -- ellipsis -- special token.
  '...',
])))

BUILTIN_NAMES = {
    'print', 'nil', 'true', 'false',
    'iter', 'len', 'id', 'repr', 'str',
    'Number', 'String', 'List',
    'assert',
}

def is_wordchar(c):
  return c == '_' or c.isalnum()

ESCAPE_TABLE = {
  'n': '\n',
  't': '\t',
  '\\': '\\',
  "'": "'",
  '"': '"',
}

def string_to_source(string):
  return Source('<unknown>', string)

def lex(source):
  if isinstance(source, str):
    source = string_to_source(source)

  # state
  tokens = []
  s = source.text
  i = [0]
  indent_stack = [0]
  paren_depth = [0]

  # helper functions
  def ch(k=None):
    if k is None:
      k = i[0]
    return s[k] if k < len(s) else ''

  def skip_empty_line():
    if i[0] >= len(s):
      return False
    j = i[0]
    while j < len(s) and ch(j) != '\n':
      if ch(j) == '#':
        while j < len(s) and ch(j) != '\n':
          j += 1
      elif ch(j).isspace():
        j += 1
      else:
        return False
    if ch(j) == '\n':
      j += 1
    i[0] = j
    return True

  def skip_empty_lines():
    while skip_empty_line():
      pass

  def skip_spaces():
    while True:
      if ch() == '\\' and ch(i[0]+1) == '\n':
        i[0] += 2
      elif ch() == '#':
        while i[0] < len(s) and ch() != '\n':
          i[0] += 1
      elif ch().isspace() and (ch() != '\n' or paren_depth[0]):
        i[0] += 1
      else:
        break

  def process_indentation():
    j = i[0]
    while ch(j) == ' ':
      j += 1
    if ch(j) == '\t':
      raise ParseError(
          Token(source, j, 'ERR'), 'Indent with tabs not allowed')
    depth = j - i[0]
    if indent_stack[-1] < depth:
      indent_stack.append(depth)
      tokens.append(Token(source, i[0], 'INDENT'))
    elif indent_stack[-1] > depth:
      while indent_stack[-1] > depth:
        indent_stack.pop()
        tokens.append(Token(source, i[0], 'DEDENT'))
      if indent_stack[-1] != depth:
        raise ParseError(
            Token(source, j, 'ERR'),
            'Invalid indentation depth')

  # tokenizing logic
  while True:
    skip_empty_lines()
    process_indentation()
    if i[0] >= len(s):
      break
    while True:
      skip_spaces()
      if i[0] >= len(s) or ch() == '\n':
        tokens.append(Token(source, i[0], 'NEWLINE'))
        break
      # STRING
      if s.startswith(('"', "'", 'r"""', "r'''"), i[0]):
        j = i[0]
        raw = False
        if ch(j) == 'r':
          j += 1
          raw = True
        result = ''
        quote = s[j:j+3] if s.startswith(('"""', "'''"), j) else s[j]
        j += len(quote)
        while not s.startswith(quote, j):
          if j >= len(s):
            raise ParseError(
                Token(source, j, 'ERR'), 'unterminated string literal')
          if not raw and ch(j) == '\\':
            j += 1
            escape = ESCAPE_TABLE.get(ch(j), None)
            if escape is None:
              raise ParseError(
                  Token(source, j, 'ERR'), 'invalid escape: ' + ch(j))
            result += escape
            j += 1
          else:
            result += ch(j)
            j += 1
        tokens.append(Token(source, i[0], 'STRING', result))
        i[0] = j + len(quote)
        continue
      # NUMBER
      if ch().isdigit() or ch() == '.' and ch(i[0]+1).isdigit():
        j = i[0]
        while ch(j).isdigit():
          j += 1
          if ch(j) == '.':
            j += 1
            while ch(j).isdigit():
              j += 1
        tokens.append(Token(source, i[0], 'NUMBER', float(s[i[0]:j])))
        i[0] = j
        continue
      # NAME/KEYWORDS
      if is_wordchar(ch()):
        j = i[0]
        while is_wordchar(ch(j)):
          j += 1
        word = s[i[0]:j]
        if word in KEYWORDS:
          tokens.append(Token(source, i[0], word))
        else:
          tokens.append(Token(source, i[0], 'NAME', word))
        i[0] = j
        continue
      # SYMBOLS
      if any(s.startswith(symbol, i[0]) for symbol in SYMBOLS):
        symbol = next(
            symbol for symbol in SYMBOLS if s.startswith(symbol, i[0]))
        if symbol in '([{':
          paren_depth[0] += 1
        elif symbol in '}])':
          paren_depth[0] -= 1
        tokens.append(Token(source, i[0], symbol))
        i[0] += len(symbol)
        continue
      # ERR
      j = i[0]
      while j < len(s) and not ch(j).isspace():
        j += 1
      raise ParseError(
          Token(source, i[0], 'ERR'),
          'unrecognized token: %s' % s[i[0]:j])
  tokens.append(Token(source, i[0], 'EOF'))
  return tokens

#### ast

class Ast(object):
  def __init__(self, token):
    self.token = token

  def __repr__(self):
    pairs = []
    for key, value in self.__dict__.items():
      pairs.append((key, repr(value).replace('\n', '\n    ')))
    result = '%s(%s)' % (
        type(self).__name__,
        ''.join('\n  %s=%s' % pair for pair in sorted(pairs)))
    return ''.join('\n' + line.rstrip() for line in result.splitlines())

class FileInput(Ast):
  def __init__(self, token, statements):
    super(FileInput, self).__init__(token)
    self.block = Block(token, statements)

  def accept(self, visitor):
    return visitor.visit_file_input(self)

class ArgumentList(Ast):
  def __init__(self, token, args, optargs, vararg):
    super(ArgumentList, self).__init__(token)
    self.args = args  # [str]
    self.optargs = optargs  # [str]
    self.vararg = vararg  # str|None

  def accept(self, visitor):
    return visitor.visit_argument_list(self)

class ExpressionList(Ast):
  def __init__(self, token, args, vararg):
    super(ExpressionList, self).__init__(token)
    self.args = args  # [Expression]
    self.vararg = vararg  # Expression|None

  def accept(self, visitor):
    return visitor.visit_expression_list(self)

class Statement(Ast):
  pass

class Block(Ast):
  def __init__(self, token, statements):
    super(Block, self).__init__(token)
    self.statements = statements  # [Statement]

  def accept(self, visitor):
    return visitor.visit_block(self)

# Note that due to decorators, function and class statements might
# produce values that aren't functions or classes.

class Function(Statement):
  def __init__(
      self, token, decorators, name, arguments, body,
      is_generator, is_async):
    super(Function, self).__init__(token)
    self.decorators = decorators  # [Expression]
    self.name = name  # str
    self.arguments = arguments  # ArgumentList
    self.body = body  # Block
    self.is_generator = is_generator  # bool
    self.is_async = is_async  # bool

  def accept(self, visitor):
    return visitor.visit_function(self)

class Class(Statement):
  def __init__(self, token, decorators, name, bases, methods):
    super(Class, self).__init__(token)
    self.decorators = decorators  # [Expression]
    self.name = name  # str
    self.bases = bases  # [Expression]
    self.methods = methods  # [FunctionStatement]

  def accept(self, visitor):
    return visitor.visit_class(self)

class Pass(Statement):
  def __init__(self, token):
    super(Pass, self).__init__(token)

  def accept(self, visitor):
    return visitor.visit_pass(self)

class If(Statement):
  def __init__(self, token, pairs, other):
    super(If, self).__init__(token)
    self.pairs = pairs  # [(Expression, Block)]
    self.other = other  # Block|None

  def accept(self, visitor):
    return visitor.visit_if(self)

class While(Statement):
  def __init__(self, token, condition, body):
    super(While, self).__init__(token)
    self.condition = condition  # Expression
    self.body = body  # Block

  def accept(self, visitor):
    return visitor.visit_while(self)

class For(Statement):
  def __init__(self, token, name, expression, body):
    super(For, self).__init__(token)
    self.name = name  # str
    self.expression = expression  # Expression
    self.body = body  # Block

  def accept(self, visitor):
    return visitor.visit_for(self)

class Break(Statement):
  def __init__(self, token):
    super(Break, self).__init__(token)

  def accept(self, visitor):
    return visitor.visit_break(self)

class Continue(Statement):
  def __init__(self, token):
    super(Continue, self).__init__(token)

  def accept(self, visitor):
    return visitor.visit_continue(self)

class Return(Statement):
  def __init__(self, token, expression):
    super(Return, self).__init__(token)
    self.expression = expression

  def accept(self, visitor):
    return visitor.visit_return(self)

class ExpressionStatement(Statement):
  def __init__(self, token, expression):
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_expression_statement(self)

class Expression(Ast):
  pass

class SimpleAssignment(Expression):
  def __init__(self, token, name, expression):
    super(SimpleAssignment, self).__init__(token)
    self.name = name  # str
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_simple_assignment(self)

class Name(Expression):
  def __init__(self, token, name):
    super(Name, self).__init__(token)
    self.name = name  # str

  def accept(self, visitor):
    return visitor.visit_name(self)

class Self(Expression):
  def __init__(self, token):
    super(Self, self).__init__(token)

  def accept(self, visitor):
    return visitor.visit_self(self)

class NumberLiteral(Expression):
  def __init__(self, token, value):
    super(NumberLiteral, self).__init__(token)
    self.value = value  # float

  def accept(self, visitor):
    return visitor.visit_number_literal(self)

class StringLiteral(Expression):
  def __init__(self, token, value):
    super(StringLiteral, self).__init__(token)
    self.value = value  # str

  def accept(self, visitor):
    return visitor.visit_string_literal(self)

class ListDisplay(Expression):
  def __init__(self, token, expressions):
    super(ListDisplay, self).__init__(token)
    self.expressions = expressions  # ExpressionList

  def accept(self, visitor):
    return visitor.visit_list_display(self)

class Lambda(Expression):
  def __init__(self, token, arguments, expression):
    super(Lambda, self).__init__(token)
    self.arguments = arguments  # ArgumentList
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_lambda(self)

class Yield(Expression):
  def __init__(self, token, expression):
    super(Yield, self).__init__(token)
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_yield(self)

class And(Expression):
  def __init__(self, token, left, right):
    super(And, self).__init__(token)
    self.left = left  # Expression
    self.right = right  # Exprssion

  def accept(self, visitor):
    return visitor.visit_and(self)

class Or(Expression):
  def __init__(self, token, left, right):
    super(Or, self).__init__(token)
    self.left = left  # Expression
    self.right = right  # Expression

  def accept(self, visitor):
    return visitor.visit_or(self)

class Not(Expression):
  def __init__(self, token, expression):
    super(Not, self).__init__(token)
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_not(self)

class Ternary(Expression):
  def __init__(self, token, condition, left, right):
    super(Ternary, self).__init__(token)
    self.condition = condition
    self.left = left
    self.right = right

  def accept(self, visitor):
    return visitor.visit_ternary(self)

class Import(Expression):
  def __init__(self, token, uri):
    super(Import, self).__init__(token)
    self.uri = uri

  def accept(self, visitor):
    return visitor.visit_import(self)

class SetAttribute(Expression):
  def __init__(self, token, owner, name, expression):
    super(SetAttribute, self).__init__(token)
    self.owner = owner  # Expression
    self.name = name  # str
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_set_attribute(self)

class GetAttribute(Expression):
  def __init__(self, token, owner, name):
    super(GetAttribute, self).__init__(token)
    self.owner = owner  # Expression
    self.name = name  # str

  def accept(self, visitor):
    return visitor.visit_get_attribute(self)

class MethodCall(Expression):
  def __init__(self, token, owner, name, expressions):
    super(MethodCall, self).__init__(token)
    self.owner = owner  # Expression
    self.name = name  # str
    self.expressions = expressions  # ExpressionList

  def accept(self, visitor):
    return visitor.visit_method_call(self)

def operator_call(token, owner, name, args):
  return MethodCall(token, owner, name, ExpressionList(token, args, None))

#### parser

class Parser(object):
  def __init__(self, source):
    if isinstance(source, str):
      source = string_to_source(source)
    self.soruce = source
    self.tokens = lex(source)
    self.cursor = 0
    self.peek = self.tokens[0]

  def gettok(self):
    token = self.peek
    self.cursor += 1
    self.peek = self.tokens[self.cursor]
    return token

  def at(self, type_):
    return type_ == self.peek.type

  def consume(self, type_):
    if self.at(type_):
      return self.gettok()

  def expect(self, type_):
    if not self.at(type_):
      raise ParseError(self.peek, 'expected %s but found %s' % (
          type_, self.peek.type))
    return self.gettok()

  # rules

  def parse_file_input(self):
    token = self.peek
    stmts = []
    while self.consume('NEWLINE'):
      pass
    while not self.at('EOF'):
      stmts.append(self.parse_statement())
      while self.consume('NEWLINE'):
        pass
    return FileInput(token, stmts)

  def skip_newlines(self):
    while self.consume('NEWLINE'):
      pass

  def parse_block(self):
    token = self.peek
    stmts = []
    self.skip_newlines()
    self.expect('INDENT')
    while True:
      self.skip_newlines()
      if self.consume('DEDENT'):
        break
      stmts.append(self.parse_statement())
    self.skip_newlines()
    return Block(token, stmts)

  def parse_argument_list(self):
    token = self.peek
    args = []
    optargs = []
    vararg = None
    while self.at('NAME'):
      args.append(self.expect('NAME').value)
      self.consume(',')
    while self.consume('/'):
      optargs.append(self.expect('NAME').value)
      self.consume(',')
    if self.consume('*'):
      vararg = self.expect('NAME').value
    return ArgumentList(token, args, optargs, vararg)

  def parse_statement(self):
    token = self.peek

    if self.consume('pass'):
      self.expect('NEWLINE')
      return Pass(token)

    if self.consume('if'):
      cond = self.parse_expression()
      self.expect('NEWLINE')
      body = self.parse_block()
      pairs = [(cond, body)]
      while self.consume('elif'):
        cond = self.parse_expression()
        self.expect('NEWLINE')
        body = self.parse_block()
        pairs.append((cond, body))
      if self.consume('else'):
        self.expect('NEWLINE')
        other = self.parse_block()
      else:
        other = None
      return If(token, pairs, other)

    if self.consume('for'):
      name = self.expect('NAME').value
      self.expect('in')
      cont = self.parse_expression()
      self.expect('NEWLINE')
      body = self.parse_block()
      return For(token, name, cont, body)

    if self.consume('return'):
      e = self.parse_expression()
      self.expect('NEWLINE')
      return Return(token, e)

    if self.at('@') or self.at('async') or self.at('def'):
      decorators = []
      while self.consume('@'):
        decorators.append(self.parse_expression())
        self.expect('NEWLINE')

      is_async = bool(self.consume('async'))
      self.expect('def')
      is_generator = bool(self.consume('*'))
      name = self.expect('NAME').value
      self.expect('(')
      args = self.parse_argument_list()
      self.expect(')')
      block = self.parse_block()
      return Function(
          token, decorators, name, args, block, is_generator, is_async)

    # If we get this far, it means that we have an expression statement.
    e = self.parse_expression()
    self.expect('NEWLINE')
    return ExpressionStatement(token, e)

  def parse_expression(self):
    return self.parse_conditional_expression()

  def parse_conditional_expression(self):
    expr = self.parse_or_expression()

    token = self.peek
    if self.consume('if'):
      cond = self.parse_expression()
      self.expect('else')
      rhs = self.parse_or_expression()
      return Ternary(token, cond, expr, rhs)

    return expr

  def parse_or_expression(self):
    expr = self.parse_and_expression()
    token = self.peek
    while self.consume('or'):
      rhs = self.parse_and_expression()
      expr = Or(token, expr, rhs)
      token = self.peek
    return expr

  def parse_and_expression(self):
    expr = self.parse_not_expression()
    token = self.peek
    while self.consume('and'):
      rhs = self.parse_not_expression()
      expr = And(token, expr, rhs)
      token = self.peek
    return expr

  def parse_not_expression(self):
    token = self.consume('not')
    if token:
      return Not(token, self.parse_comparison_expression())
    else:
      return self.parse_comparison_expression()

  def parse_comparison_expression(self):
    # TODO: Python style chained comparisons.
    expr = self.parse_additive_expression()
    token = self.peek

    if self.consume('<'):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__lt', [rhs])

    if self.consume('<='):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__le', [rhs])

    if self.consume('>'):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__gt', [rhs])

    if self.consume('>='):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__ge', [rhs])

    if self.consume('=='):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__eq', [rhs])

    if self.consume('!='):
      rhs = self.parse_additive_expression()
      return operator_call(token, expr, '__ne', [rhs])

    return expr

  def parse_additive_expression(self):
    expr = self.parse_multiplicative_expression()
    while True:
      token = self.peek

      if self.consume('+'):
        rhs = self.parse_multiplicative_expression()
        expr = operator_call(token, expr, '__add', [rhs])
        continue

      if self.consume('-'):
        rhs = self.parse_multiplicative_expression()
        expr = operator_call(token, expr, '__sub', [rhs])
        continue

      break
    return expr

  def parse_multiplicative_expression(self):
    expr = self.parse_prefix_expression()
    while True:
      token = self.peek

      if self.consume('*'):
        rhs = self.parse_prefix_expression()
        expr = operator_call(token, expr, '__mul', [rhs])
        continue

      if self.consume('/'):
        rhs = self.parse_prefix_expression()
        expr = operator_call(token, expr, '__div', [rhs])
        continue

      if self.consume('//'):
        rhs = self.parse_prefix_expression()
        expr = operator_call(token, expr, '__floordiv', [rhs])
        continue

      if self.consume('%'):
        rhs = self.parse_prefix_expression()
        expr = operator_call(token, expr, '__mod', [rhs])
        continue

      break
    return expr

  def parse_prefix_expression(self):
    token = self.peek
    if self.consume('+'):
      expr = self.parse_exponent_expression()
      return operator_call(token, expr, '__pos', [])

    if self.consume('-'):
      expr = self.parse_exponent_expression()
      return operator_call(token, expr, '__neg', [])

    return self.parse_exponent_expression()

  def parse_exponent_expression(self):
    expr = self.parse_postfix_expression()
    while True:
      token = self.peek

      if self.consume('**'):
        rhs = self.parse_postfix_expression()
        expr = operator_call(token, expr, '__pow', [rhs])
        continue

      break
    return expr

  def parse_postfix_expression(self):
    expr = self.parse_primary_expression()
    while True:
      token = self.peek

      if self.consume('('):
        args = self.parse_expression_list()
        self.expect(')')
        expr = MethodCall(token, expr, '__call', args)
        continue

      if self.consume('.'):
        name = self.expect('NAME').value
        if self.consume('('):
          args = self.parse_expression_list()
          self.expect(')')
          expr = MethodCall(token, expr, name, args)
        elif self.consume('='):
          value = self.parse_expression()
          expr = SetAttribute(token, expr, name, value)
        else:
          expr = GetAttribute(token, expr, name)
        continue

      break
    return expr

  def at_expression_delimiter(self):
    return self.at(')') or self.at('NEWLINE') or self.at(']')

  def parse_expression_list(self):
    token = self.peek
    exprs = []
    vararg = None
    while not self.at_expression_delimiter():
      if self.consume('*'):
        vararg = self.parse_expression()
        break
      exprs.append(self.parse_expression())
      if not self.at_expression_delimiter():
        self.expect(',')
    return ExpressionList(token, exprs, vararg)

  def parse_primary_expression(self):
    token = self.consume('NUMBER')
    if token:
      return NumberLiteral(token, token.value)

    token = self.consume('STRING')
    if token:
      return StringLiteral(token, token.value)

    token = self.consume('NAME')
    if token:
      name = token.value
      if self.consume('='):
        expression = self.parse_expression()
        return SimpleAssignment(token, name, expression)
      else:
        return Name(token, name)

    token = self.consume('(')
    if token:
      expr = self.parse_expression()
      self.expect(')')
      return expr

    token = self.consume('[')
    if token:
      exprlist = self.parse_expression_list()
      self.expect(']')
      return ListDisplay(token, exprlist)

    token = self.consume('import')
    if token:
      uri = self.expect('STRING').value
      return Import(token, uri)

    token = self.consume('yield')
    if token:
      e = self.parse_expression()
      return Yield(token, e)

    raise ParseError(self.peek, 'expected expression')

def parse(source):
  return Parser(source).parse_file_input()

#### transpiler

REVERSE_ESCAPE_TABLE = {v:k for k, v in ESCAPE_TABLE.items()}

def escape_string(string):
  return ''.join('\\' + c if c in REVERSE_ESCAPE_TABLE else c for c in string)

class Reader(object):
  def __init__(self, root):
    self.root = root

  def read(self, uri):
    with open(os.path.join(self.root, uri.replace('/', os.sep))) as f:
      return f.read()

class Transpiler(object):
  def __init__(self, reader, visitor_factory):
    self.reader = reader
    self.visitor_factory = visitor_factory
    self.loaded = set()
    self.queued = set()
    self.modules = []

  def load(self, uri, native=False):
    if uri in self.loaded:
      return

    self.queued.add(uri)
    raw_data = self.reader.read(uri)
    visitor = self.visitor_factory()
    if native:
      data = visitor.visit_native_module(uri, raw_data)
    else:
      data = Parser(Source(uri, raw_data)).parse_file_input().accept(visitor)
    for imp in visitor.native_imports:
      if imp not in self.loaded:
        if imp in self.queued:
          raise Exception('circular imports detected involving %s and %s' % (
              uri, imp))
        else:
          self.load(imp, native=True)
    for imp in visitor.imports:
      if imp not in self.loaded:
        if imp in self.queued:
          raise Exception('circular imports detected involving %s and %s' % (
              uri, imp))
        else:
          self.load(imp)
    self.modules.append(data)
    self.loaded.add(uri)

  def generate_code(self, main_uri):
    return self.visitor_factory.visit_modules(self.modules, main_uri)

## javascript

class JavascriptCodeGenerator(object):
  def __init__(self):
    self.native_imports = []
    self.imports = []
    self.context_stack = []  # for generating stack trace on exception

    # These are the variables that need to be explicitly declared
    # for each scope.
    self.declare_stack = [set()]
    # These are the variables that are implicitly declared for each scope
    # (e.g. either because they are builtins or they come with
    # the parameters of a function).
    self.implicit_declare_stack = [set(BUILTIN_NAMES)]
    # These are the variables that we reference in each scope.
    # We keep track of thses so that we never hit an undefined reference
    # error. Whenever we pop out of a scope, we check whether they have
    # been declared somewhere. If they haven't, we move them up a scope.
    # If any scope in the used_stack is non-empty by the time we finish
    # parsing the file, we know that these variables were never declared
    # where they needed to be.
    self.used_stack = [dict()]

  def push_scope(self):
    self.declare_stack.append(set())
    self.implicit_declare_stack.append(set())
    self.used_stack.append(dict())

  def pop_scope(self):
    used = self.used_stack.pop()
    combined = self.declare_stack + self.implicit_declare_stack
    for x in used:
      if not any(x in scope for scope in combined):
        self.used_stack[-1][x] = used[x]
    self.implicit_declare_stack.pop()
    return self.declare_stack.pop()

  def declare_variable(self, name):
    self.declare_stack[-1].add(name)

  def declare_implicit_variable(self, name):
    if not any(name in scope for scope in self.used_stack):
      self.implicit_declare_stack[-1].add(name)

  def log_variable_reference(self, name, token):
    self.used_stack[-1][name] = token

  def verify_all_variables_declared(self):
    for used in self.used_stack:
      for name in used:
        raise ParseError(used[name], 'Undeclared name "%s"' % name)

  @classmethod
  def visit_modules(cls, modules, main_uri):
    return """/* jshint esversion: 6 */
(function() {
"use strict";
%s
let MODULE_LOADERS = {%s
};
let LOADED_MODULES = {};
function loadModuleRaw(uri) {
  if (!LOADED_MODULES[uri]) {
    if (!MODULE_LOADERS[uri]) {
      throw new Error('No such module ' + uri);
    }
    let module = LOADED_MODULES[uri] = {};
    MODULE_LOADERS[uri](module);
  }
  return LOADED_MODULES[uri];
}
function catchAndDisplay(f) {
  try {
    f();
  } catch (e) {
    if (e instanceof Err) {
      console.log(e.toString());
    } else {
      throw e;
    }
  }
}
catchAndDisplay(function() {
  loadModuleRaw("core/prelude.sl");
  loadModuleRaw("%s");
});
})();
""" % (JS_PRELUDE, ''.join(modules), main_uri)

  def visit_native_module(self, uri, data):
    if data.startswith('/* jshint esversion: 6 */'):
      data = data[len('/* jshint esversion: 6 */'):]
    return """
"%s": function(exports) {%s
  return exports;
},""" % (uri, data.replace('\n', '\n  '))

  def visit_file_input(self, node):
    self.push_scope()
    data = node.block.accept(self)
    names = self.pop_scope()
    self.verify_all_variables_declared()

    data = ''.join('\nlet sl%s = slnil;' % n for n in names) + data
    data += ''.join('\nexports.sl%s = sl%s;' % (n, n) for n in names)

    return self.visit_native_module(node.token.source.uri, data)

  def visit_block(self, node):
    return '\n{%s}' % ''.join(stmt.accept(self) for stmt in node.statements)

  def visit_argument_list(self, node):
    for name in node.args + node.optargs + [node.vararg]:
      if name:
        self.declare_implicit_variable(name)

    if node.vararg:
      check = '\ncheckargsmin(args, %d);' % len(node.args)
    elif node.optargs:
      check = '\ncheckargsrange(args, %d, %d);' % (
          len(node.args), len(node.args) + len(node.optargs))
    else:
      check = '\ncheckargs(args, %d);' % len(node.args)

    assign = ''
    i = 0
    for name in node.args:
      assign += '\nlet sl%s = args[%d];' % (name, i)
      i += 1
    for name in node.optargs:
      assign += '\nlet sl%s = args[%d] ? args[%d] : slnil;' % (name, i, i)
      i += 1
    if node.vararg:
      assign += '\nlet sl%s = args.slice(%d);' % (node.vararg, i)
    return check + assign

  def wrap_with_decorators(self, decorators, converted_expression):
    result = converted_expression
    for decorator in decorators:
      d = decorator.accept(self)
      result = 'callm(%s, "sl__call", [%s])' % (
          decorator.accept(self), result)
    return result

  def visit_function(self, node):
    if node.is_async:
      raise ParseError(node.token, 'Async functions not yet supported')

    self.push_scope()
    arglist = node.arguments.accept(self)
    body = node.body.accept(self)
    names = self.pop_scope()

    body = ''.join('\nlet sl%s = slnil;' % n for n in names) + body

    if node.is_generator:
      f = 'new slxGenerator("%s", function*(args) {%s%s\n})' % (
          node.name, arglist, body)
    else:
      f = 'new slxFunction("%s", function(args) {%s%s\n})' % (
          node.name, arglist, body)

    self.declare_variable(node.name)
    return '\nsl%s = %s;' % (
        node.name, self.wrap_with_decorators(node.decorators, f))

  def visit_for(self, node):
    # TODO: Make trace work if it turns out that the object we are
    # trying to iterate over is not actually iterable.
    self.declare_variable(node.name)
    return '\nfor (sl%s of %s)%s' % (
        node.name,
        self.wrap_expression_in_context(node.expression),
        node.body.accept(self))

  def visit_if(self, node):
    cond, body = node.pairs[0]
    main = '\nif (%s)%s' % (
        self.wrap_expression_in_context(cond),
        body.accept(self))
    pairs = ['\nelse if (%s)%s' % (
        self.wrap_expression_in_context(cond),
        body.accept(self)) for cond, body in node.pairs[1:]]
    other = ''
    if node.other:
      other = '\nelse ' + node.other.accept(self)
    return '%s%s%s' % (main, ''.join(pairs), other)

  def make_frame(self, node):
    return '["%s", %d, "%s"]' % (
        node.token.source.uri,
        node.token.line_number,
        '.'.join(self.context_stack) or '<module>')

  def wrap_exprstmt(self, node):
    """This is probably a serious optimization killer (try-catch makes
    functions unoptimizable),
    but I can't think of any other way to get certain functionality to
    work, e.g. 'yield'. I can't wrap 'yield' in a function to pass
    to slxRun.
    """
    frame = self.make_frame(node)
    return """try { %s; } catch (e) {
  if (e instanceof Err) {
    e.stacktrace.push(%s);
  } else {
    let e2 = new Err(e);
    e2.stacktrace.push(%s);
    throw e2;
  }
  throw e;
}""" % (node.accept(self), frame, frame)

  def wrap_expression_in_context(self, node):
    """DEPRECATED.
    If you use this, you can't use e.g. yield inside the expression.
    Use wrap_exprstmt if you can.
    """
    return 'slxRun(%s, function(){return %s; })' % (
        self.make_frame(node), node.accept(self))

  def visit_expression_statement(self, node):
    return '\n%s' % (self.wrap_exprstmt(node.expression),)

  def visit_return(self, node):
    return '\nreturn %s;' % (
        self.wrap_expression_in_context(node.expression),)

  def visit_expression_list(self, node):
    if node.vararg:
      raise ParseError(node.token, 'varargs not yet supported')
    return '[%s]' % (
        ', '.join(arg.accept(self) for arg in node.args),)

  def visit_method_call(self, node):
    return 'callm(%s, "sl%s", %s)' % (
        node.owner.accept(self),
        node.name,
        node.expressions.accept(self))

  def visit_name(self, node):
    self.log_variable_reference(node.name, node.token)
    return 'sl' + node.name

  def visit_string_literal(self, node):
    return 'new slxString("%s")' % escape_string(node.value)

  def visit_number_literal(self, node):
    return 'new slxNumber(%d)' % node.value

  def visit_list_display(self, node):
    return 'new slxList(%s)'  % (
        self.visit_expression_list(node.expressions),)

  def visit_simple_assignment(self, node):
    self.declare_variable(node.name)
    return '(sl%s = %s)' % (node.name, node.expression.accept(self))

  def visit_yield(self, node):
    return '(yield %s)' % (node.expression.accept(self),)

  def visit_not(self, node):
    return '((%s).truthy() ? slfalse : sltrue)' % (
        node.expression.accept(self),)

  def visit_import(self, node):
    if node.uri.endswith('.js'):
      self.native_imports.append(node.uri)
    else:
      self.imports.append(node.uri)
    return 'loadModule("%s")' % node.uri

#### tests

## lexer tests

def tokens_to_pairs(tokens):
  return [(token.type, token.value) for token in tokens]

# Simple sanity check
pairs = tokens_to_pairs(lex("'hello world'"))
assert pairs == [
    ('STRING', 'hello world'), ('NEWLINE', None), ('EOF', None),
], pairs

# Test each token category at least once.
pairs = tokens_to_pairs(lex("""
while True:
  'hello\\n world' 5 4.4 x.y # hoi
# fun"""))
assert pairs == [
    ('while', None), ('True', None), (':', None), ('NEWLINE', None),
    ('INDENT', None),
        ('STRING', 'hello\n world'),
        ('NUMBER', 5.0), ('NUMBER', 4.4),
        ('NAME', 'x'), ('.', None), ('NAME', 'y'),
        ('NEWLINE', None),
    ('DEDENT', None),
('EOF', None)], pairs

# Make sure NEWLINE/INDENT/DEDENT are ignored inside parenthesis.
pairs = tokens_to_pairs(lex("""
(
    )
"""))
assert pairs == [
    ('(', None), (')', None), ('NEWLINE', None), ('EOF', None)
], pairs

## Parser tests

result = parse("""
hello
5
if a
  b
elif c
  d
else
  e
""")

expected = """
FileInput(
  block=
    Block(
      statements=[
        ExpressionStatement(
          expression=
            Name(
              name='hello'
              token=Token(source, 1, 'NAME', 'hello'))),
        ExpressionStatement(
          expression=
            NumberLiteral(
              token=Token(source, 7, 'NUMBER', 5.0)
              value=5.0)),
        If(
          other=
            Block(
              statements=[
                ExpressionStatement(
                  expression=
                    Name(
                      name='e'
                      token=Token(source, 36, 'NAME', 'e')))]
              token=Token(source, 34, 'INDENT', None))
          pairs=[(
            Name(
              name='a'
              token=Token(source, 12, 'NAME', 'a')),
            Block(
              statements=[
                ExpressionStatement(
                  expression=
                    Name(
                      name='b'
                      token=Token(source, 16, 'NAME', 'b')))]
              token=Token(source, 14, 'INDENT', None))), (
            Name(
              name='c'
              token=Token(source, 23, 'NAME', 'c')),
            Block(
              statements=[
                ExpressionStatement(
                  expression=
                    Name(
                      name='d'
                      token=Token(source, 27, 'NAME', 'd')))]
              token=Token(source, 25, 'INDENT', None)))]
          token=Token(source, 9, 'if', None))]
      token=Token(source, 1, 'NAME', 'hello'))
  token=Token(source, 1, 'NAME', 'hello'))"""

assert repr(result) == expected, result

#### main

LANGUAGE_TO_VISITOR_FACTORY_TABLE = {
    'js': JavascriptCodeGenerator,
}

def main():
  if len(sys.argv) != 5:
    print('usage: python %s <language> <root> <input_uri> <output_path>' % (
        sys.argv[0]))
    exit(1)
  _, language, root, input_uri, output_path = sys.argv
  visitor_factory = LANGUAGE_TO_VISITOR_FACTORY_TABLE.get(language, None)
  if visitor_factory is None:
    print('language must be one of [%s] but found %s' % (
        ', '.join(LANGUAGE_TO_VISITOR_FACTORY_TABLE), language))
    exit(1)
  reader = Reader(root)
  try:
    transpiler = Transpiler(reader, visitor_factory)
    transpiler.load('core/prelude.sl')
    transpiler.load(input_uri)
    output = transpiler.generate_code(input_uri)
  except ParseError as e:
    print(str(e).strip())
    exit(1)
  with open(output_path, 'w') as f:
    f.write(output)


if __name__ == '__main__':
  main()
