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
i = 10
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

print('tests pass!')
