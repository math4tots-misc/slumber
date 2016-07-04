"""bblexer.py
"""

OPEN_PARENTHESIS = '('
CLOSE_PARENTHESIS = ')'
OPEN_BRACKET = '['
CLOSE_BRACKET = ']'

KEYWORDS = {
    'interface', 'class', 'public', 'private', 'static',
    'extends', 'implements',
    'package', 'from', 'import', 'as',
    'while', 'break', 'continue', 'if', 'else', 'return',
    'not', 'and', 'or',
    'null', 'this', 'super', 'true', 'false', 'new',
}

PRIMITIVE_TYPES = {
    'void', 'bool', 'int', 'float',
}

SYMBOLS = tuple(reversed(sorted((
    '(', ')', '[', ']', '{', '}',
    '=', '+=', '-=', '%=', '*=', '/=',
    '+', '-', '*', '/', '%',
    '<', '>', '<=', '>=', '==', '!=',
    '?', ':',
    ';', '.', ',',
))))

ESCAPE_TABLE = {
    'n': '\n',
    't': '\t',
    '\\': '\\',
    '"': '"',
    "'": "'",
}


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
            while (self.pos < len(self.text) and
                   self.text[self.pos].isdigit()):
                self.pos += 1
            if self.pos < len(self.text) and self.text[self.pos] == '.':
                self.pos += 1
                while (self.pos < len(self.text) and
                       self.text[self.pos].isdigit()):
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
                   (len(value) == 1 or
                    not value.isupper()))):
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
