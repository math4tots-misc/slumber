"""slumber.py

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
#### lexer

class Source(object):
  def __init__(self, uri, text):
    self.uri = uri
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
  'assert', 'else', 'import', 'pass',
  'break', 'except', 'in', 'raise',
  # my keywords
  'async', 'await',
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
  def __init__(self, token, decorators, name, body):
    super(FunctionStatement, self).__init__(token)
    self.decorators = decorators  # [Expression]
    self.name = name  # str
    self.body = body  # Block

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
    return visitor.visit_continue(token)

class Return(Statement):
  def __init__(self, token, expression):
    super(Return, self).__init__(token)
    self.expression = expression

  def accept(self, visitor):
    return visitor.visit_return(token)

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
    return visitor.visit_name_expression(self)

class NumberLiteral(Expression):
  def __init__(self, token, value):
    super(NumberLiteral, self).__init__(token)
    self.value = value  # float

  def accept(self, visitor):
    return visitor.visit_number_expression(self)

class StringLiteral(Expression):
  def __init__(self, token, value):
    super(StringLiteral, self).__init__(token)
    self.value = value  # str

  def accept(self, visitor):
    return visitor.visit_string_expression(self)

class Lambda(Expression):
  def __init__(self, token, arguments, expression):
    super(Lambda, self).__init__(token)
    self.arguments = arguments  # ArgumentList
    self.expression = expression  # Expression

  def accept(self, visitor):
    return visitor.visit_lambda(self)

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

    # If we get this far, it means that we have an expression statement.
    e = self.parse_expression()
    self.expect('NEWLINE')
    return ExpressionStatement(token, e)

  def parse_expression(self):
    return self.parse_primary_expression()

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

    raise ParseError(self.peek, 'expected expression')

def parse(source):
  return Parser(source).parse_file_input()

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
