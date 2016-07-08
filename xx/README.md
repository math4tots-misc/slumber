

namespaces
==========

I might add this later.

For now, compiling is simpler using global names.

In the future, I'd like to add a notion of 'packages'

For instance, your files will start with:

    package local.one;

A package may have multiple files, but each file is
associated with exactly one package.

And all global names that are declared and used will
by default be prefixed by this package, so that
e.g. a global declaration that looks like

    int x;

Is actually declaration for a variable named
'local.one.x'.

Special builtins like 'String', 'print', etc will
be imported by default.

Otherwise, each name will have to be imported manually,
for instance,

    import java.util.ArrayList;

which would alias the name 'ArrayList' as 'java.util.ArrayList',
or

    import foo.bar.Baz as Fbb;

which would import the class 'foo.bar.Baz' aliased as Fbb;

apologies
=========

'real' seems like a bad name for 


maybes
======

Should 'string' be a primitive type?
I think it's ok to delay this, since if string literals were actually
'string', and we always use it in contexts that require 'String',
the casting would be seamless.

Should 'list' be a primitive type?

Should I split 'real' back into 'int' and 'float'?
Originally I had separate 'int' and 'float' primitive types, but I'm not
sure that that's really all that useful or necessary for most cases.

