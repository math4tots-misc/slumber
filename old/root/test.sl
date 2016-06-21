assert(true)
assert(not false)
assert(1 == 1)
assert(1 != 2)
assert(5 + 6 == 11)
assert('hey ' + 'there' == 'hey there')

x = 7
assert(x + 44 == 51, x + 44)
y = x + 44
assert(y == 51, y)

def f(a, b)
  return a + 5 * b + c

c = 10

assert(f(1, 5) == 36, f(1, 5))

result = false
i = 5
if i < 10
  result = true
else
  assert(false)

assert(result)

def* g()
  yield 5
  yield 7

gg = g()
assert(gg.__more())
assert((k = gg.__next()) == 5, k)
assert(gg.__more())
assert((k = gg.__next()) == 7, k)
assert(not gg.__more())

xs = []
for x in g()
  xs.push(x)
assert(xs == [5, 7])

assert([1, 2] != [1, 3])

xs = []
for y in [1, 2, 3]
  xs.push(y)
assert(xs == [1, 2, 3])

assert(repr([5, 6, 7]) == '[5, 6, 7]')

assert(1 == 1)
assert([1] == [1])
assert(not ([1] == [2]))

def wrapper(f)
  return 'bb ' + f()

@wrapper
def h()
  return 'hoi'

assert(h == 'bb hoi', h)

class X
  def __init(name)
    self.name = name

  def sayHi()
    return 'hi ' + self.name

  def* count()
    assert(self.sayHi() == 'hi Bob')
    yield 10
    yield 13
    yield 17

x = X('Bob')
assert(x.sayHi() == 'hi Bob')
assert(List(x.count()) == [10, 13, 17])

@addMethodTo(X)
def foo()
  return 'bar'

assert(x.foo() == 'bar')

xs = [5, 6, 7]
assert(len(xs) == 3, len(xs))
assert(xs[0] == 5, xs[0])
assert(xs[1] == 6, xs[1])
assert(xs[2] == 7, xs[2])
r = (xs[1] = 11)
assert(r == 11, r)
assert(xs[1] == 11, xs[1])

assert(5 < 10)
assert(not (10 < 5))

i = 0
while i < 10
  i = i + 1
assert(i == 10, i)

# For testing 'sync', just verify that the code in the block
# runs.
x = false
sync
  x = true
assert(x)

def addOne(x)
  return x + 1

xs = List(map(addOne, [1, 2, 3]))
assert(xs == [2, 3, 4], xs)

lf = \x . 2*x + 1

assert(lf(1) == 3, lf(1))
assert(lf(2) == 5, lf(2))

xs = List(map(\x. 2*x + 1, [1, 2, 3]))
assert(xs == [3, 5, 7], xs)

xs = List(filter(\x. x > 5, map(\x. 2*x + 1, range(10))))
assert(xs == [7, 9, 11, 13, 15, 17, 19], xs)

print('tests pass!')


