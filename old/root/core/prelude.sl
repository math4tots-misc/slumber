def* map(f, xs)
  for x in xs
    yield f(x)

def* filter(f, xs)
  for x in xs
    r = f(x)
    if f(x)
      yield x

def* range(start, /end)
  if end == nil
    end = start
    start = 0

  i = start
  while i < end
    yield i
    i = i + 1

@addMethodTo(Object)
def __gt(right)
  return right < self

@addMethodTo(Object)
def __ge(right)
  return not (self < right)

@addMethodTo(Object)
def __le(right)
  return not (right < self)

@addMethodTo(Object)
def __ne(right)
  return not (self == right)

