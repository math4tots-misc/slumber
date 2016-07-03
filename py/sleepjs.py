import sleepparser as parser


class JavascriptTranspiler(object):

    def __init__(self, loader):
        self.loader = loader
        self.results = []
        self.loaded = set()

    def get_program(self):
        self.results = [''.join(self.results)]
        return self.results[0]

    def load(self, uri):
        data = self.loader.load(uri)
        source = parser.Source(uri, data)
        ast = parser.parse(source)
        self.results.append(self.visit(ast))

    def visit(self, node):
        return node.accept(self)

    def visit_file_input(self, node):
        pass



