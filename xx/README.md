

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

